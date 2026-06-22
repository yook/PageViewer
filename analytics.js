window.dataLayer = window.dataLayer || [];

(function (m, e, t, r, i, k, a) {
  m[i] =
    m[i] ||
    function () {
      (m[i].a = m[i].a || []).push(arguments);
    };
  m[i].l = 1 * new Date();
  for (var j = 0; j < document.scripts.length; j += 1) {
    if (document.scripts[j].src === r) {
      return;
    }
  }
  k = e.createElement(t);
  a = e.getElementsByTagName(t)[0];
  k.async = 1;
  k.src = r;
  a.parentNode.insertBefore(k, a);
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=110061757", "ym");

window.ym(110061757, "init", {
  ssr: true,
  webvisor: true,
  clickmap: true,
  ecommerce: "dataLayer",
  referrer: document.referrer,
  url: location.href,
  accurateTrackBounce: true,
  trackLinks: true,
});

window.PageViewerAnalytics = window.PageViewerAnalytics || {
  counterId: 110061757,
  trackGoal(goal, params) {
    if (!goal || typeof window.ym !== "function") {
      return false;
    }

    try {
      if (params && typeof params === "object") {
        window.ym(this.counterId, "reachGoal", goal, params);
      } else {
        window.ym(this.counterId, "reachGoal", goal);
      }
      return true;
    } catch {
      return false;
    }
  },
  trackOnce(key, goal, params) {
    if (!key || !goal) {
      return false;
    }

    try {
      if (window.sessionStorage.getItem(key) === "1") {
        return false;
      }
      const tracked = this.trackGoal(goal, params);
      if (tracked) {
        window.sessionStorage.setItem(key, "1");
      }
      return tracked;
    } catch {
      return this.trackGoal(goal, params);
    }
  },
};
