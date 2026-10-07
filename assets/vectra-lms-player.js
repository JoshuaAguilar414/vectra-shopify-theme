(function () {
  var root = document.querySelector('[data-vlms-player]');
  if (!root) return;

  var apiBase =
    (window.VECTRA_LMS_API_BASE && String(window.VECTRA_LMS_API_BASE).replace(/\/$/, '')) ||
    '/apps/lms/api';

  function api(path, options) {
    options = options || {};
    var headers = Object.assign(
      { Accept: 'application/json' },
      options.headers || {},
      window.VECTRA_LMS_HEADERS || {}
    );
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    var body = options.body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      body = JSON.stringify(body);
    }
    return fetch(apiBase + path, {
      method: options.method || 'GET',
      headers: headers,
      body: body,
      credentials: 'include',
      keepalive: !!options.keepalive
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  function extractProgress(data) {
    if (!data || typeof data !== 'object') return undefined;
    if (data.type === 'progress') {
      var n = Number(data.progressMeasure ?? data.progress ?? data.value);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return n > 1 ? n / 100 : n;
    }
    return undefined;
  }

  var params = new URLSearchParams(window.location.search);
  var assignmentId = params.get('assignment') || params.get('assignmentId') || root.getAttribute('data-assignment-id');
  if (!assignmentId) {
    root.innerHTML = '<div class="vlms-card"><p class="vlms-empty">Missing assignment id.</p></div>';
    return;
  }

  var titleEl = root.querySelector('[data-vlms-player-title]');
  var statusEl = root.querySelector('[data-vlms-player-status]');
  var frame = root.querySelector('[data-vlms-player-frame]');
  var overlay = root.querySelector('[data-vlms-player-loading]');
  var values = {};
  var initialized = false;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function commit() {
    setStatus('Saving…');
    return api('/progress', {
      method: 'POST',
      body: { assignmentId: assignmentId, values: values },
      keepalive: true
    })
      .then(function (data) {
        setStatus(data.completed ? 'Completed · saved' : 'Progress saved');
        return data;
      })
      .catch(function () {
        setStatus('Save failed');
        return null;
      });
  }

  var lastError = '0';
  window.API = {
    LMSInitialize: function () {
      initialized = true;
      if (!values['cmi.core.lesson_status'] || values['cmi.core.lesson_status'] === 'not attempted') {
        values['cmi.core.lesson_status'] = 'incomplete';
      }
      setStatus('In progress');
      commit();
      lastError = '0';
      return 'true';
    },
    LMSFinish: function () {
      commit();
      initialized = false;
      lastError = '0';
      return 'true';
    },
    LMSGetValue: function (element) {
      lastError = '0';
      return values[element] || '';
    },
    LMSSetValue: function (element, value) {
      values[element] = String(value);
      lastError = '0';
      return 'true';
    },
    LMSCommit: function () {
      commit();
      lastError = '0';
      return 'true';
    },
    LMSGetLastError: function () {
      return lastError;
    },
    LMSGetErrorString: function (code) {
      return code === '0' ? 'No error' : 'SCORM runtime error';
    },
    LMSGetDiagnostic: function (code) {
      return 'SCORM 1.2 diagnostic code ' + code;
    }
  };

  window.addEventListener('message', function (event) {
    var progress = extractProgress(event.data);
    if (progress === undefined && event.data && event.data.type === 'otto-scorm-child-message') {
      progress = extractProgress(event.data.data);
    }
    if (progress === undefined) return;
    values['cmi.progress_measure'] = String(progress);
    commit();
  });

  window.addEventListener('pagehide', function () {
    if (initialized) commit();
  });
  window.setInterval(function () {
    if (initialized) commit();
  }, 30000);

  var saveBtn = root.querySelector('[data-vlms-player-save]');
  if (saveBtn) saveBtn.addEventListener('click', function () { commit(); });

  api('/learn/' + encodeURIComponent(assignmentId))
    .then(function (data) {
      if (titleEl) titleEl.textContent = data.course.title || 'Course';
      setStatus(data.assignment.status || 'NOT_STARTED');
      var scorm = data.assignment.scormData || {};
      if (scorm.lessonStatus) values['cmi.core.lesson_status'] = scorm.lessonStatus;
      if (scorm.lessonLocation) values['cmi.core.lesson_location'] = scorm.lessonLocation;
      if (scorm.suspendData) values['cmi.suspend_data'] = scorm.suspendData;
      if (scorm.scoreRaw != null) values['cmi.core.score.raw'] = String(scorm.scoreRaw);
      if (scorm.progressMeasure != null) values['cmi.progress_measure'] = String(scorm.progressMeasure);

      var launch = data.course.launchUrl;
      if (window.VECTRA_LMS_API_BASE && launch.indexOf('/apps/lms/') === 0) {
        launch = String(window.VECTRA_LMS_API_BASE).replace(/\/api\/?$/, '') + launch.replace(/^\/apps\/lms/, '');
      }
      if (frame) {
        frame.src = launch;
        frame.addEventListener('load', function () {
          if (overlay) overlay.hidden = true;
        });
      }
    })
    .catch(function (err) {
      root.innerHTML = '<div class="vlms-card"><p class="vlms-empty">' + (err.message || 'Unable to launch course') + '</p></div>';
    });
})();
