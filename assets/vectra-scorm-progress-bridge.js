(function () {
  var BRIDGE_FLAG = "data-otto-scorm-progress-bridge";

  function normalizeProgress(value) {
    var num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return num > 1 ? num / 100 : num;
  }

  function extractProgress(data) {
    if (!data || typeof data !== "object") return null;
    if (data.type === "progress") return normalizeProgress(data.progressMeasure ?? data.progress ?? data.value);
    if (data.type === "score") {
      var status = typeof data.scormStatus === "string" ? data.scormStatus.toLowerCase() : "";
      if (status && status !== "incomplete") return null;
      return normalizeProgress(data.score);
    }
    return null;
  }

  function persistProgress(progressMeasure) {
    var api = window.parent && window.parent.API;
    if (!api || typeof api.LMSSetValue !== "function") return false;

    api.LMSSetValue("cmi.progress_measure", String(progressMeasure));
    if (typeof api.LMSCommit === "function") api.LMSCommit("");
    return true;
  }

  function notifyParent(event) {
    try {
      if (!window.parent || window.parent === window) return;
      window.parent.postMessage(
        {
          type: "otto-scorm-child-message",
          origin: event.origin,
          data: event.data
        },
        window.location.origin
      );
    } catch (error) {
      console.warn("VECTRA SCORM bridge notify failed", error);
    }
  }

  function handleMessage(event) {
    notifyParent(event);

    try {
      var progressMeasure = extractProgress(event.data);
      if (progressMeasure === null) return;
      persistProgress(progressMeasure);
    } catch (error) {
      console.warn("VECTRA SCORM progress bridge failed", error);
    }
  }

  if (document.documentElement.getAttribute(BRIDGE_FLAG) === "1") return;
  document.documentElement.setAttribute(BRIDGE_FLAG, "1");
  window.addEventListener("message", handleMessage, true);
})();
