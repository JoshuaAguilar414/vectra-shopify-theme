(function () {
  var root = document.querySelector('[data-vectra-lms]');
  if (!root) return;

  var apiBase =
    (window.VECTRA_LMS_API_BASE && String(window.VECTRA_LMS_API_BASE).replace(/\/$/, '')) ||
    root.getAttribute('data-vlms-api-base') ||
    '/apps/lms/api';

  var shop = root.getAttribute('data-vlms-shop') || '';
  var customerId = root.getAttribute('data-vlms-customer-id') || '';
  var customerTags = root.getAttribute('data-vlms-customer-tags') || '';
  var isStaff = root.getAttribute('data-vlms-staff') === 'true';
  var screen = root.getAttribute('data-vlms-screen') || '';

  function apiUrl(path) {
    var base = apiBase.replace(/\/$/, '');
    var p = path.charAt(0) === '/' ? path : '/' + path;
    // Support both /apps/lms/api/... and local /proxy/api/...
    if (base.endsWith('/api') && p.indexOf('/api/') === 0) {
      p = p.slice(4);
    }
    return base + p;
  }

  function headers(extra) {
    var h = Object.assign({ Accept: 'application/json' }, extra || {});
    if (shop) h['X-LMS-Shop'] = shop;
    if (customerId) h['X-LMS-Customer-Id'] = customerId;
    if (customerTags) h['X-LMS-Customer-Tags'] = customerTags;
    if (isStaff) h['X-LMS-Staff'] = 'true';
    return h;
  }

  function api(path, options) {
    options = options || {};
    var opts = {
      method: options.method || 'GET',
      headers: headers(options.headers || {}),
      credentials: 'same-origin'
    };
    if (options.body instanceof FormData) {
      opts.body = options.body;
    } else if (options.body != null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(options.body);
    }
    return fetch(apiUrl(path), opts).then(function (res) {
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('text/csv') !== -1) return res.text().then(function (text) {
        if (!res.ok) throw new Error(text || res.statusText);
        return text;
      });
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || res.statusText || 'Request failed');
        return data;
      });
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setText(sel, value) {
    var el = root.querySelector(sel);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function showNote(message, isError) {
    var note = root.querySelector('[data-vlms-note]');
    if (!note) {
      if (isError) console.error(message);
      else console.log(message);
      return;
    }
    note.hidden = !message;
    note.textContent = message;
    note.classList.toggle('is-error', !!isError);
  }

  /* ——— Overview / dashboard stats ——— */
  function loadDashboard() {
    var period = (root.querySelector('[data-vlms-period] .vlms-pill.is-active') || {}).getAttribute
      ? root.querySelector('[data-vlms-period] .vlms-pill.is-active').getAttribute('data-period')
      : 'all';
    api('/dashboard').then(function (data) {
      var stats = data.stats || {};
      var p = (stats.periods && stats.periods[period || 'all']) || {};
      var learners = stats.learners || {};
      setText('[data-vlms-stat="learners"]', learners.total || 0);
      setText('[data-vlms-stat="learners-detail"]', (learners.active || 0) + ' active · ' + (learners.invited || 0) + ' invited');
      setText('[data-vlms-stat="assignments"]', p.total || 0);
      setText('[data-vlms-stat="assignments-detail"]', (stats.courses || 0) + ' published courses');
      setText('[data-vlms-stat="started"]', p.inProgress || 0);
      setText('[data-vlms-stat="started-detail"]', (p.notStarted || 0) + ' not opened yet');
      var pct = p.total ? Math.round((p.completed / p.total) * 100) : 0;
      setText('[data-vlms-stat="completed"]', p.completed || 0);
      setText('[data-vlms-stat="completed-detail"]', pct + '% of assignments');
    }).catch(function (err) {
      showNote(err.message, true);
    });
  }

  root.querySelectorAll('[data-vlms-period] .vlms-pill').forEach(function (btn) {
    btn.addEventListener('click', function () {
      root.querySelectorAll('[data-vlms-period] .vlms-pill').forEach(function (el) {
        el.classList.remove('is-active');
      });
      btn.classList.add('is-active');
      if (screen === 'overview') loadDashboard();
    });
  });

  /* ——— Participants ——— */
  function renderParticipants(rows) {
    var table = root.querySelector('[data-vlms-participant-table] tbody');
    if (!table) return;
    var facilities = rows.filter(function (r) { return r.stakeholderGroup === 'Facility'; }).length;
    var partners = rows.filter(function (r) { return r.stakeholderGroup === 'Business Partner'; }).length;
    setText('[data-vlms-count="orgs"]', rows.length);
    setText('[data-vlms-count="facilities"]', facilities);
    setText('[data-vlms-count="partners"]', partners);
    if (!rows.length) {
      table.innerHTML = '<tr class="vlms-empty-row"><td colspan="7" class="vlms-empty">No organizations yet.</td></tr>';
      return;
    }
    table.innerHTML = rows.map(function (row) {
      return (
        '<tr data-id="' + escapeHtml(row.id) + '">' +
        '<td>' + escapeHtml(row.stakeholderGroup || '') + '</td>' +
        '<td>' + escapeHtml(row.companyId || '') + '</td>' +
        '<td>' + escapeHtml(row.name || '') + '</td>' +
        '<td>' + escapeHtml(row.country || '') + '</td>' +
        '<td>' + escapeHtml(row.topic || '') + '</td>' +
        '<td>' + escapeHtml(row.nominatedProvider || '') + '</td>' +
        '<td><button type="button" class="vlms-btn vlms-btn--ghost" data-vlms-delete-participant="' + escapeHtml(row.id) + '">Remove</button></td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadParticipants() {
    return api('/participants').then(function (data) {
      renderParticipants(data.participants || []);
    });
  }

  var participantForm = root.querySelector('[data-vlms-participant-form]');
  if (participantForm) {
    participantForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(participantForm);
      var body = {};
      data.forEach(function (value, key) { body[key] = String(value); });
      api('/participants', { method: 'POST', body: body })
        .then(function () {
          participantForm.reset();
          var stakeholder = participantForm.querySelector('#vlms-stakeholder');
          var topic = participantForm.querySelector('#vlms-topic');
          var provider = participantForm.querySelector('#vlms-provider');
          if (stakeholder) stakeholder.value = 'Facility';
          if (topic) topic.value = 'Freely Chosen Employment';
          if (provider) provider.value = 'VECTRA';
          showNote('Organization added.');
          return loadParticipants();
        })
        .catch(function (err) { showNote(err.message, true); });
    });
  }

  root.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-vlms-delete-participant]');
    if (!btn) return;
    var id = btn.getAttribute('data-vlms-delete-participant');
    api('/participants/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(loadParticipants)
      .catch(function (err) { showNote(err.message, true); });
  });

  var importInput = root.querySelector('[data-vlms-participant-import]');
  if (importInput) {
    importInput.addEventListener('change', function () {
      if (!importInput.files || !importInput.files[0]) return;
      var fd = new FormData();
      fd.append('file', importInput.files[0]);
      api('/participants/import', { method: 'POST', body: fd })
        .then(function (result) {
          showNote('Imported ' + (result.imported || 0) + ' rows (' + (result.upserted || 0) + ' new, ' + (result.updated || 0) + ' updated).');
          importInput.value = '';
          return loadParticipants();
        })
        .catch(function (err) { showNote(err.message, true); });
    });
  }

  /* ——— Users ——— */
  function renderUsers(users) {
    var table = root.querySelector('[data-vlms-user-table] tbody');
    if (!table) return;
    if (!users.length) {
      table.innerHTML = '<tr><td colspan="7" class="vlms-empty">No learners yet.</td></tr>';
      return;
    }
    table.innerHTML = users.map(function (u) {
      var courses = (u.assignedCourses || []).map(function (c) { return c.title; }).join(', ') || '—';
      return (
        '<tr>' +
        '<td><code>' + escapeHtml(u.id) + '</code></td>' +
        '<td>' + escapeHtml(u.firstName + ' ' + u.lastName) + '</td>' +
        '<td>' + escapeHtml(u.email) + '</td>' +
        '<td>' + escapeHtml(u.entity || '') + '</td>' +
        '<td>' + escapeHtml(u.status) + '</td>' +
        '<td>' + escapeHtml(courses) + '</td>' +
        '<td>' +
          '<button type="button" class="vlms-btn vlms-btn--ghost" data-vlms-user-status="' + escapeHtml(u.id) + '" data-status="INACTIVE">Deactivate</button>' +
        '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadUsers() {
    return api('/users').then(function (data) {
      renderUsers(data.users || []);
    });
  }

  var userForm = root.querySelector('[data-vlms-user-form]');
  if (userForm) {
    userForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(userForm);
      var body = { role: 'LEARNER' };
      data.forEach(function (value, key) { body[key] = String(value); });
      api('/users', { method: 'POST', body: body })
        .then(function () {
          userForm.reset();
          showNote('Learner invited.');
          return loadUsers();
        })
        .catch(function (err) { showNote(err.message, true); });
    });
  }

  root.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-vlms-user-status]');
    if (!btn) return;
    var id = btn.getAttribute('data-vlms-user-status');
    var status = btn.getAttribute('data-status') || 'INACTIVE';
    api('/users/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: { status: status } })
      .then(loadUsers)
      .catch(function (err) { showNote(err.message, true); });
  });

  /* ——— Courses ——— */
  function renderCourses(courses) {
    var table = root.querySelector('[data-vlms-course-table] tbody');
    if (!table) return;
    if (!courses.length) {
      table.innerHTML = '<tr><td colspan="4" class="vlms-empty">No courses yet.</td></tr>';
      return;
    }
    table.innerHTML = courses.map(function (c) {
      return (
        '<tr>' +
        '<td>' + escapeHtml(c.title) + '</td>' +
        '<td>' + escapeHtml(c.type) + '</td>' +
        '<td>' + (c.active ? 'Active' : 'Inactive') + '</td>' +
        '<td>' + escapeHtml(c.originalFilename || c.launchPath || '—') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadCourses() {
    return api('/courses').then(function (data) {
      renderCourses(data.courses || []);
      var select = root.querySelector('[data-vlms-assign-course]');
      if (select) {
        select.innerHTML = '<option value="">Select course</option>' +
          (data.courses || []).filter(function (c) { return c.active; }).map(function (c) {
            return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.title) + '</option>';
          }).join('');
      }
    });
  }

  var courseForm = root.querySelector('[data-vlms-course-form]');
  if (courseForm) {
    courseForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var fd = new FormData(courseForm);
      api('/courses', { method: 'POST', body: fd })
        .then(function () {
          courseForm.reset();
          showNote('Course uploaded.');
          return loadCourses();
        })
        .catch(function (err) { showNote(err.message, true); });
    });
  }

  var assignForm = root.querySelector('[data-vlms-assign-form]');
  if (assignForm) {
    assignForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(assignForm);
      api('/assignments', {
        method: 'POST',
        body: { userId: String(data.get('userId') || ''), courseId: String(data.get('courseId') || '') }
      })
        .then(function () { showNote('Assignment created.'); })
        .catch(function (err) { showNote(err.message, true); });
    });
  }

  /* ——— Reports ——— */
  function renderReports(rows) {
    var table = root.querySelector('[data-vlms-report-table] tbody');
    if (!table) return;
    if (!rows.length) {
      table.innerHTML = '<tr><td colspan="6" class="vlms-empty">No assignment progress yet.</td></tr>';
      return;
    }
    table.innerHTML = rows.map(function (r) {
      return (
        '<tr>' +
        '<td>' + escapeHtml(r.firstName + ' ' + r.lastName) + '</td>' +
        '<td>' + escapeHtml(r.entity || '') + '</td>' +
        '<td>' + escapeHtml(r.courseTitle || '') + '</td>' +
        '<td>' + escapeHtml(r.status || '') + '</td>' +
        '<td>' + escapeHtml(r.progress == null ? '' : r.progress + '%') + '</td>' +
        '<td>' + escapeHtml(r.completedAt || '—') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadReports() {
    return api('/reports').then(function (data) {
      renderReports(data.rows || []);
    });
  }

  var csvBtn = root.querySelector('[data-vlms-export-csv]');
  if (csvBtn) {
    csvBtn.addEventListener('click', function () {
      api('/reports/csv').then(function (csv) {
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'vectra-lms-progress.csv';
        a.click();
        URL.revokeObjectURL(url);
      }).catch(function (err) { showNote(err.message, true); });
    });
  }

  /* ——— Learner my-courses ——— */
  function loadMyCourses() {
    api('/learn').then(function (data) {
      var list = root.querySelector('[data-vlms-my-courses]');
      if (!list) return;
      var rows = data.assignments || [];
      if (!rows.length) {
        list.innerHTML = '<div class="vlms-empty">No courses assigned yet.</div>';
        return;
      }
      list.innerHTML = rows.map(function (a) {
        return (
          '<article class="vlms-card">' +
          '<h2>' + escapeHtml(a.course.title) + '</h2>' +
          '<p>' + escapeHtml(a.status) + ' · ' + escapeHtml(a.progress || 0) + '%</p>' +
          '<div class="vlms-actions"><a class="vlms-btn" href="' + escapeHtml(a.launchUrl) + '">Open course</a></div>' +
          '</article>'
        );
      }).join('');
    }).catch(function (err) { showNote(err.message, true); });
  }

  function loadLearnerDashboard() {
    api('/learn').then(function (data) {
      var rows = data.assignments || [];
      var inProgress = rows.filter(function (r) { return r.status === 'IN_PROGRESS'; }).length;
      var completed = rows.filter(function (r) { return r.status === 'COMPLETED'; }).length;
      setText('[data-vlms-learner-stat="assigned"]', rows.length);
      setText('[data-vlms-learner-stat="progress"]', inProgress);
      setText('[data-vlms-learner-stat="completed"]', completed);
    }).catch(function () {});
  }

  /* ——— Settings ——— */
  function loadSettings() {
    Promise.all([api('/fields'), api('/roles')]).then(function (results) {
      var fields = (results[0].fields || []).map(function (f) {
        return '<li><strong>' + escapeHtml(f.label) + '</strong> <code>' + escapeHtml(f.key) + '</code> (' + escapeHtml(f.type) + ')</li>';
      }).join('');
      var roles = (results[1].roles || []).map(function (r) {
        return '<li><strong>' + escapeHtml(r.name) + '</strong> <code>' + escapeHtml(r.key) + '</code></li>';
      }).join('');
      var fieldsEl = root.querySelector('[data-vlms-fields-list]');
      var rolesEl = root.querySelector('[data-vlms-roles-list]');
      if (fieldsEl) fieldsEl.innerHTML = fields || '<li class="vlms-empty">No fields</li>';
      if (rolesEl) rolesEl.innerHTML = roles || '<li class="vlms-empty">No roles</li>';
    }).catch(function (err) { showNote(err.message, true); });
  }

  /* ——— Boot ——— */
  var booters = {
    overview: loadDashboard,
    participants: loadParticipants,
    users: function () { return Promise.all([loadUsers(), loadCourses()]); },
    courses: loadCourses,
    reports: loadReports,
    settings: loadSettings,
    dashboard: loadLearnerDashboard,
    'my-courses': loadMyCourses
  };

  if (booters[screen]) {
    Promise.resolve(booters[screen]()).catch(function (err) {
      showNote(err.message || 'Failed to load LMS data', true);
    });
  }

  window.VectraLms = { api: api, apiBase: apiBase };
})();
