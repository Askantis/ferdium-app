// Favorites "mode" controller (Sophie).
// Owns the side effects behind the pinned Favorites tab:
//  - toggles the `mode__favorites` body class (CSS reveals our panel + the target webview),
//  - navigates the selected favorite's service webview to the conversation,
//  - hides WhatsApp's own nav rail + chat-list panes so only the conversation shows.
//
// WhatsApp Web ships obfuscated, frequently-changing class names and has dropped its
// stable ids (#side/#main), so we DON'T match on classes. Instead we inject a small
// script that finds the layout row STRUCTURALLY — the flex container whose children
// are ≥2 full-height, side-by-side panes — keeps the widest (the conversation) and
// hides the rest, re-applying via a MutationObserver. Everything is marker-class +
// <style> based so it tears down cleanly on exit; the normal WhatsApp tab is untouched.
import { reaction } from 'mobx';
import { buildDeepLink } from './send';
import { type Favorite, favoritesMode, getFavorites } from './store';

// Injected into the WhatsApp webview: hide the nav rail + chat list, keep the
// conversation, strip the divider border, and keep it applied as WhatsApp re-renders.
const WA_INJECT = `(function(){try{
  var HIDE='sophie-fav-hide-el', MAIN='sophie-fav-main-el', STYLE='sophie-favorites-hide';
  function ensureStyle(){
    var s=document.getElementById(STYLE);
    if(!s){s=document.createElement('style');s.id=STYLE;(document.head||document.documentElement).appendChild(s);}
    s.textContent='.'+HIDE+'{display:none!important}.'+MAIN+'{border-left:0!important;border-right:0!important;box-shadow:none!important;flex:1 1 auto!important}';
  }
  function clearMarks(){
    var a=document.querySelectorAll('.'+HIDE);for(var i=0;i<a.length;i++)a[i].classList.remove(HIDE);
    var b=document.querySelectorAll('.'+MAIN);for(var j=0;j<b.length;j++)b[j].classList.remove(MAIN);
  }
  function apply(){
    ensureStyle();
    // Anchors that have been stable in WhatsApp Web for years (unlike the
    // obfuscated x-classes): the conversation is #main, the app row is .two.
    var main=document.getElementById('main');
    var row=main&&main.closest('.two');
    if(!main||!row){ clearMarks(); return; }
    // The direct child of the row that contains #main is the conversation column.
    var wrap=main;
    while(wrap.parentElement && wrap.parentElement!==row){ wrap=wrap.parentElement; }
    if(wrap.parentElement!==row){ clearMarks(); return; }
    clearMarks();
    var vh=window.innerHeight*0.8, wx=wrap.getBoundingClientRect().left;
    var kids=row.children;
    for(var i=0;i<kids.length;i++){
      var k=kids[i]; if(k===wrap) continue;
      var r=k.getBoundingClientRect();
      // hide the full-height panes sitting to the left of the conversation
      // (the nav rail + the chat list); leave popovers/overlays alone.
      if(r.height>vh && r.left < wx+5){ k.classList.add(HIDE); }
    }
    wrap.classList.add(MAIN);
    main.classList.add(MAIN);
  }
  window.__sophieFavApply=apply;
  apply();
  if(window.__sophieFavObs){ window.__sophieFavObs.disconnect(); }
  var t=null;
  window.__sophieFavObs=new MutationObserver(function(){ if(t)clearTimeout(t); t=setTimeout(apply,250); });
  window.__sophieFavObs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
}catch(e){}})();`;

const WA_CLEAR = `(function(){try{
  if(window.__sophieFavObs){ window.__sophieFavObs.disconnect(); window.__sophieFavObs=null; }
  var H='sophie-fav-hide-el', M='sophie-fav-main-el';
  var a=document.querySelectorAll('.'+H);for(var i=0;i<a.length;i++)a[i].classList.remove(H);
  var b=document.querySelectorAll('.'+M);for(var j=0;j<b.length;j++)b[j].classList.remove(M);
  var s=document.getElementById('sophie-favorites-hide'); if(s) s.remove();
  window.__sophieFavApply=null;
}catch(e){}})();`;

let injectedStores: any = null;
let injectedActions: any = null;

// serviceIds whose webview currently has the hide injection applied.
const styledServiceIds = new Set<string>();
// webviews we've attached a re-inject listener to (loadURL drops the injection).
const loadListenerAttached = new Set<string>();

const runInWebview = (service: any, js: string): void => {
  const view = service?.webview;
  if (!view) {
    return;
  }
  try {
    view.executeJavaScript(js);
  } catch {
    // webview not ready / navigating — ignore
  }
};

const applyHideCss = (service: any): void => {
  styledServiceIds.add(service.id);
  runInWebview(service, WA_INJECT);
};

const removeHideCss = (service: any): void => {
  styledServiceIds.delete(service.id);
  runInWebview(service, WA_CLEAR);
};

// loadURL reloads WhatsApp and drops the injection, so re-apply it whenever the
// target finishes loading — but only while it is still the favorites target.
const ensureLoadListener = (service: any): void => {
  const view = service?.webview;
  if (!view || loadListenerAttached.has(service.id)) {
    return;
  }
  view.addEventListener('did-stop-loading', () => {
    if (
      favoritesMode.isActive &&
      favoritesMode.targetServiceId === service.id
    ) {
      applyHideCss(service);
    }
  });
  loadListenerAttached.add(service.id);
};

// Run cb once the service has an attached webview (awake() mounts it async).
const whenWebviewReady = (
  service: any,
  cb: (service: any) => void,
  tries = 40,
): void => {
  if (service?.webview) {
    cb(service);
    return;
  }
  if (tries <= 0) {
    return;
  }
  setTimeout(() => whenWebviewReady(service, cb, tries - 1), 150);
};

const stopLoading = (): void => favoritesMode.setLoading(false);

// Poll the (reloading) webview until WhatsApp's conversation (#main) has
// rendered, then hide the chrome and drop the masking overlay — so the user
// sees our overlay → the conversation, never WhatsApp's splash or a sidebar flash.
const whenChatReady = (service: any, tries = 50): void => {
  const view = service?.webview;
  if (!view) {
    if (tries <= 0) {
      stopLoading();
      return;
    }
    setTimeout(() => whenChatReady(service, tries - 1), 200);
    return;
  }
  view
    .executeJavaScript('!!document.getElementById("main")')
    .then((ready: boolean) => {
      if (ready) {
        applyHideCss(service);
        stopLoading();
      } else if (tries > 0) {
        setTimeout(() => whenChatReady(service, tries - 1), 200);
      } else {
        stopLoading();
      }
    })
    .catch(() => {
      if (tries > 0) {
        setTimeout(() => whenChatReady(service, tries - 1), 200);
      } else {
        stopLoading();
      }
    });
};

// The favorite whose chat is currently loaded in the (shared) WhatsApp webview,
// so re-selecting it skips the expensive reload.
let lastLoadedFavoriteId: string | null = null;

export const selectFavorite = (favorite: Favorite): void => {
  const service = injectedStores?.services?.one(favorite.serviceId);
  if (!service) {
    return;
  }

  favoritesMode.setSelection(favorite.id, service.id);

  // Wake the target WITHOUT making it the active service (that would leave
  // favorites mode). awake() un-hibernates it so the webview mounts.
  injectedActions?.service?.awake({ serviceId: service.id });

  // Already showing this chat — no reload, just make sure the chrome is hidden.
  if (favorite.id === lastLoadedFavoriteId) {
    whenWebviewReady(service, s => {
      ensureLoadListener(s);
      applyHideCss(s);
    });
    return;
  }

  const url = buildDeepLink(service.recipe?.id, favorite.target, '');
  if (!url) {
    // No deep link (non-WhatsApp): just reveal it as-is, no overlay.
    whenWebviewReady(service, s => {
      ensureLoadListener(s);
      applyHideCss(s);
    });
    return;
  }

  lastLoadedFavoriteId = favorite.id;
  favoritesMode.setLoading(true);
  whenWebviewReady(service, s => {
    ensureLoadListener(s);
    try {
      s.webview.loadURL(url);
    } catch {
      // navigation rejected — webview still revealed on the right
    }
    whenChatReady(s);
  });
};

export const enterFavorites = (): void => {
  const favorites = getFavorites();
  if (favorites.length === 0) {
    return;
  }
  favoritesMode.setActive(true);

  const current = favorites.find(
    f => f.id === favoritesMode.selectedFavoriteId,
  );
  selectFavorite(current ?? favorites[0]);
};

export const exitFavorites = (): void => {
  if (!favoritesMode.isActive) {
    return;
  }
  favoritesMode.setActive(false);
  favoritesMode.setLoading(false);
  // The shared WhatsApp webview may be navigated away while used normally, so
  // force a fresh load next time favorites mode opens.
  lastLoadedFavoriteId = null;
  // the reaction below tears down the injection on the target
};

export default function initFavorites(stores: any, actions: any): void {
  injectedStores = stores;
  injectedActions = actions;

  // Toggle the body class that drives the favorites-mode CSS (mirrors mode__split).
  reaction(
    () => favoritesMode.isActive,
    isActive => {
      document.body.classList.toggle('mode__favorites', isActive);
    },
    { fireImmediately: true },
  );

  // Any real service becoming active (tab click, Quick Switch, shortcut) leaves
  // favorites mode — a safety net beyond the wrapped tab handler.
  reaction(
    () => injectedStores?.services?.active?.id,
    () => {
      if (favoritesMode.isActive) {
        exitFavorites();
      }
    },
  );

  // Apply / tear down the WhatsApp hide injection as the target changes. Removing
  // it from non-target services is what keeps the normal WhatsApp tab untouched.
  reaction(
    () => ({
      isActive: favoritesMode.isActive,
      targetServiceId: favoritesMode.targetServiceId,
    }),
    ({ isActive, targetServiceId }) => {
      for (const serviceId of styledServiceIds) {
        if (!isActive || serviceId !== targetServiceId) {
          const service = injectedStores?.services?.one(serviceId);
          if (service) {
            removeHideCss(service);
          }
        }
      }

      if (isActive && targetServiceId) {
        const service = injectedStores?.services?.one(targetServiceId);
        if (service && service.recipe?.id === 'whatsapp') {
          ensureLoadListener(service);
          applyHideCss(service);
        }
      }
    },
    { fireImmediately: true },
  );
}
