
'use strict';

const STORAGE_KEY = 'campus_hub_records_v2';
const THEME_KEY = 'campus_hub_theme';

/* ---------- Persistence layer ---------- */
const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('Failed to read storage:', err);
      return null;
    }
  },
  save(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to write storage:', err);
    }
  }
};

/* ---------- State & business logic ---------- */
const Store = {
  items: [],
  filters: { query: '', type: 'all', category: 'all', status: 'open', sort: 'newest' },

  init() {
    const saved = Storage.load();
    if (saved) {
      this.items = saved;
    } else {
      this.items = [
        { id: 1, title: 'Apple iPad Pro 11"', type: 'lost', category: 'Electronics', date: '2026-10-01', location: 'Advanced Quantum Lab, Room 402', description: 'Space grey, black folio case.', contact: 'research-station@campus.edu', status: 'open' },
        { id: 2, title: 'Lab Notebook Binder', type: 'found', category: 'Documents', date: '2026-10-03', location: 'Biotech Lab Reception', description: 'Blue binder with chemistry notes.', contact: 'frontdesk-bio@campus.edu', status: 'open' },
        { id: 3, title: 'Titanium Mechanical Pencil', type: 'lost', category: 'Accessories', date: '2026-10-04', location: 'Design Architecture Studio B', description: '', contact: '9876543210', status: 'open' }
      ];
      this.persist();
    }
  },

  persist() { Storage.save(this.items); },

  add(item) { this.items.unshift(item); this.persist(); },

  toggleResolved(id) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.status = item.status === 'resolved' ? 'open' : 'resolved';
      this.persist();
    }
    return item;
  },

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.persist();
  },

  getVisible() {
    const { query, type, category, status, sort } = this.filters;
    const list = this.items.filter(i => {
      const hay = `${i.title} ${i.location} ${i.description || ''}`.toLowerCase();
      return hay.includes(query)
        && (type === 'all' || i.type === type)
        && (category === 'all' || i.category === category)
        && (status === 'all' || i.status === status);
    });
    const sorters = {
      newest: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
      oldest: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
      title: (a, b) => a.title.localeCompare(b.title)
    };
    return list.sort(sorters[sort]);
  },

  getStats() {
    const total = this.items.length;
    const resolved = this.items.filter(i => i.status === 'resolved').length;
    const open = this.items.filter(i => i.status === 'open');
    return {
      total,
      resolved,
      lost: open.filter(i => i.type === 'lost').length,
      found: open.filter(i => i.type === 'found').length,
      rate: total ? Math.round((resolved / total) * 100) : 0
    };
  }
};

/* ---------- Validation ---------- */
const Validator = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  PHONE: /^[6-9]\d{9}$/,

  title(v) {
    if (!v.trim()) return 'Item name is required.';
    if (v.trim().length < 3) return 'Item name must be at least 3 characters.';
    return '';
  },
  date(v) {
    if (!v) return 'Please select a date.';
    if (v > new Date().toISOString().split('T')[0]) return 'Date cannot be in the future.';
    return '';
  },
  location(v) {
    if (!v.trim()) return 'Campus location is required.';
    return '';
  },
  contact(v) {
    const val = v.trim();
    if (!val) return 'Contact detail is required.';
    if (!this.EMAIL.test(val) && !this.PHONE.test(val)) return 'Enter a valid email or 10-digit mobile number.';
    return '';
  }
};

/* ---------- Toast notifications ---------- */
const Toast = {
  show(message, type = 'info') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
};

/* ---------- Utilities ---------- */
const Utils = {
  escape(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  today() { return new Date().toISOString().split('T')[0]; },
  formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  debounce(fn, ms = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },
  exportCSV(rows) {
    const header = ['ID', 'Title', 'Type', 'Category', 'Date', 'Location', 'Description', 'Contact', 'Status'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map(i => [i.id, i.title, i.type, i.category, i.date, i.location, i.description, i.contact, i.status].map(q).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lost-found-report-${Utils.today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
};

/* ---------- UI controller ---------- */
const UI = {
  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      form: $('item-form'), grid: $('items-grid'), empty: $('empty-state'),
      title: $('item-title'), type: $('item-type'), category: $('item-category'),
      date: $('item-date'), location: $('item-location'), desc: $('item-description'),
      contact: $('item-contact'), descCount: $('desc-count'),
      search: $('search-query'), fType: $('filter-type'), fCat: $('filter-category'),
      fStatus: $('filter-status'), sort: $('sort-order'),
      count: $('result-count'), theme: $('theme-toggle'),
      export: $('btn-export'), resetFilters: $('btn-reset-filters'),
      stats: { total: $('stat-total'), lost: $('stat-lost'), found: $('stat-found'), resolved: $('stat-resolved'), rate: $('stat-rate') }
    };

    this.el.date.max = Utils.today();
    this.el.date.value = Utils.today();
    this.applySavedTheme();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const e = this.el;

    e.form.addEventListener('submit', ev => this.handleSubmit(ev));
    e.form.addEventListener('reset', () => setTimeout(() => {
      this.clearErrors();
      e.date.value = Utils.today();
      e.descCount.textContent = '0';
    }));
    e.desc.addEventListener('input', () => { e.descCount.textContent = e.desc.value.length; });

    // Live validation feedback on blur
    ['title', 'date', 'location', 'contact'].forEach(f =>
      e[f].addEventListener('blur', () => this.validateField(f)));

    e.search.addEventListener('input', Utils.debounce(ev => {
      Store.filters.query = ev.target.value.toLowerCase().trim();
      this.render();
    }));
    [['fType', 'type'], ['fCat', 'category'], ['fStatus', 'status'], ['sort', 'sort']].forEach(([elKey, key]) =>
      e[elKey].addEventListener('change', ev => { Store.filters[key] = ev.target.value; this.render(); }));

    e.resetFilters.addEventListener('click', () => this.resetFilters());
    e.export.addEventListener('click', () => {
      const rows = Store.getVisible();
      if (!rows.length) return Toast.show('Nothing to export.', 'error');
      Utils.exportCSV(rows);
      Toast.show(`Exported ${rows.length} record(s).`, 'success');
    });

    // Event delegation for card actions
    e.grid.addEventListener('click', ev => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'resolve') {
        const item = Store.toggleResolved(id);
        Toast.show(item.status === 'resolved' ? 'Marked as resolved.' : 'Re-opened.', 'success');
      } else if (btn.dataset.action === 'delete') {
        if (!confirm('Delete this record permanently?')) return;
        Store.remove(id);
        Toast.show('Record deleted.', 'success');
      }
      this.render();
    });

    e.theme.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      document.body.dataset.theme = next;
      try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* ignore */ }
    });
  },

  applySavedTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t) document.body.dataset.theme = t;
    } catch (_) { /* ignore */ }
  },

  validateField(name) {
    const input = this.el[name];
    const msg = Validator[name](input.value);
    const err = document.getElementById(`error-${name}`);
    err.textContent = msg ? `⚠ ${msg}` : '';
    err.classList.toggle('show', !!msg);
    input.classList.toggle('is-invalid', !!msg);
    return !msg;
  },

  clearErrors() {
    ['title', 'date', 'location', 'contact'].forEach(f => {
      this.el[f].classList.remove('is-invalid');
      const err = document.getElementById(`error-${f}`);
      err.textContent = ''; err.classList.remove('show');
    });
  },

  handleSubmit(ev) {
    ev.preventDefault();
    const valid = ['title', 'date', 'location', 'contact'].map(f => this.validateField(f)).every(Boolean);
    if (!valid) return Toast.show('Please fix the highlighted fields.', 'error');

    const e = this.el;
    Store.add({
      id: Date.now(),
      title: e.title.value.trim(),
      type: e.type.value,
      category: e.category.value,
      date: e.date.value,
      location: e.location.value.trim(),
      description: e.desc.value.trim(),
      contact: e.contact.value.trim(),
      status: 'open'
    });
    e.form.reset();
    Toast.show('Report submitted successfully.', 'success');
    this.render();
  },

  resetFilters() {
    Store.filters = { query: '', type: 'all', category: 'all', status: 'open', sort: 'newest' };
    const e = this.el;
    e.search.value = ''; e.fType.value = 'all'; e.fCat.value = 'all';
    e.fStatus.value = 'open'; e.sort.value = 'newest';
    this.render();
  },

  cardTemplate(i) {
    const resolved = i.status === 'resolved';
    return `
      <article class="card glass-card item-card ${resolved ? 'resolved' : ''}">
        <div>
          <div class="card-header">
            <h3>${Utils.escape(i.title)}</h3>
            <span class="badge ${resolved ? 'resolved' : i.type}">${resolved ? 'resolved' : i.type}</span>
          </div>
          ${i.description ? `<p class="item-desc">${Utils.escape(i.description)}</p>` : ''}
          <p class="item-meta">📁 <strong>Category:</strong> <span class="tag">${Utils.escape(i.category)}</span></p>
          <p class="item-meta">📍 <strong>Location:</strong> ${Utils.escape(i.location)}</p>
          <p class="item-meta">📅 <strong>Date:</strong> ${Utils.formatDate(i.date)}</p>
          <p class="item-meta">📧 <strong>Contact:</strong> ${Utils.escape(i.contact)}</p>
        </div>
        <div class="card-actions">
          <button class="btn-claim" data-action="resolve" data-id="${i.id}">${resolved ? 'Re-open' : 'Mark Resolved'}</button>
          <button class="btn-delete" data-action="delete" data-id="${i.id}" aria-label="Delete ${Utils.escape(i.title)}">🗑</button>
        </div>
      </article>`;
  },

  render() {
    const visible = Store.getVisible();
    this.el.grid.innerHTML = visible.map(i => this.cardTemplate(i)).join('');
    this.el.empty.classList.toggle('hidden', visible.length > 0);
    this.el.count.textContent = `${visible.length} result${visible.length === 1 ? '' : 's'}`;

    const s = Store.getStats();
    const st = this.el.stats;
    st.total.textContent = s.total;
    st.lost.textContent = s.lost;
    st.found.textContent = s.found;
    st.resolved.textContent = s.resolved;
    st.rate.textContent = `${s.rate}%`;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Store.init();
  UI.init();
});
