/*!
 * AgroConnect Academy — lecteur de formation (v0.6.0)
 * Vanilla JS, aucune dépendance. Monte chaque élément .aca[data-src], .aca[data-json] ou .aca[data-formation],
 * ou s'utilise par programme (React, Vue, Flutter WebView…) :
 *   const lecteur = window.AgroConnectAcademy.mount(element, { formation: 'f14', config: { server: true, restUrl: '…/' } });
 *   lecteur.destroy();
 * Tout le contenu est inséré avec textContent : aucun HTML venant des données n'est interprété.
 */
(function () {
  'use strict';

  var CFG = window.ACA_CONFIG || {};
  // Configuration modifiable par programme (window.AgroConnectAcademy.configure ou mount(…, { config })).
  function applyConfig(c) {
    if (!c) return;
    Object.keys(c).forEach(function (k) { CFG[k] = c[k]; });
    SERVER = !!CFG.server;
    if (c.loggedIn !== undefined) SESSION.loggedIn = !!c.loggedIn;
    if (c.userName !== undefined) SESSION.userName = c.userName || '';
  }
  var fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  function lcFirst(t) { t = String(t); return t.length > 1 && t[1] === t[1].toUpperCase() && t[1] !== t[1].toLowerCase() ? t : t.charAt(0).toLowerCase() + t.slice(1); }
  function money(n) { return fmt.format(Math.round(n || 0)) + ' FCFA'; }
  function num(v) { var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }

  /* ---------- petit utilitaire DOM ---------- */
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* ---------- stockage : navigateur + compte WordPress si connecté ---------- */
  var store = {
    get: function (key, fallback) {
      try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
    }
  };

  /* ---------- serveur (WordPress ou tout backend respectant le contrat d'API) ---------- */
  var SERVER = !!CFG.server;
  var SESSION = { loggedIn: !!CFG.loggedIn, userName: CFG.userName || '', nonce: CFG.nonce || '' };
  function extraHeaders() {
    var h = typeof CFG.headers === 'function' ? CFG.headers() : CFG.headers;
    return h && typeof h === 'object' ? h : {};
  }
  function getSession() {
    if (!SERVER) return Promise.resolve(SESSION);
    // Backend quelconque : GET {sessionUrl} → { loggedIn, userName }. WordPress : admin-ajax.
    var url = CFG.sessionUrl || (CFG.ajaxUrl ? CFG.ajaxUrl + '?action=aca_session' : '');
    if (!url) return Promise.resolve(SESSION);
    return fetch(url, { credentials: CFG.credentials || 'same-origin', cache: 'no-store', headers: extraHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { SESSION.loggedIn = !!j.loggedIn; SESSION.userName = j.userName || ''; SESSION.nonce = j.nonce || ''; } return SESSION; })
      .catch(function () { return SESSION; });
  }
  function api(path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (SESSION.nonce) headers['X-WP-Nonce'] = SESSION.nonce;
    var more = extraHeaders();
    Object.keys(more).forEach(function (k) { headers[k] = more[k]; });
    return fetch(CFG.restUrl + path, { method: body ? 'POST' : 'GET', credentials: CFG.credentials || 'same-origin', headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j && j.message || ('HTTP ' + r.status)); e.status = r.status; e.code = j && j.code; e.data = j && j.data; throw e; }
          return j;
        });
      });
  }
  function remoteLoad(formationId) {
    if (SERVER) {
      if (!SESSION.loggedIn) return Promise.resolve(null);
      return api('progress?formation=' + encodeURIComponent(formationId)).catch(function () { return null; });
    }
    if (!CFG.restUrl || !CFG.loggedIn || !window.fetch) return Promise.resolve(null);
    return fetch(CFG.restUrl + 'progress?formation=' + encodeURIComponent(formationId), {
      credentials: 'same-origin', headers: { 'X-WP-Nonce': CFG.nonce }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function remoteSave(formationId, progress) {
    if (SERVER) return; // en mode serveur, la progression est enregistrée par le serveur lors de la correction
    if (!CFG.restUrl || !CFG.loggedIn || !window.fetch) return;
    fetch(CFG.restUrl + 'progress', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': CFG.nonce },
      body: JSON.stringify({ formation: formationId, progress: progress })
    }).catch(function () { /* hors ligne : la copie locale suffit */ });
  }

  /* ---------- blocs de leçon ---------- */
  function tableBlock(head, rows, numericCols) {
    numericCols = numericCols || [];
    var thead = el('thead', null, [el('tr', null, head.map(function (h, i) {
      return el('th', { scope: 'col', class: numericCols.indexOf(i) > -1 ? 'num' : null, text: h });
    }))]);
    var tbody = el('tbody', null, rows.map(function (r) {
      var flag = r.length > head.length ? r[head.length] : null;
      return el('tr', { class: flag ? 'is-' + flag : null }, r.slice(0, head.length).map(function (c, i) {
        return el('td', { class: numericCols.indexOf(i) > -1 ? 'num' : null, text: c });
      }));
    }));
    return el('div', { class: 'aca-table-wrap' }, [el('table', null, [thead, tbody])]);
  }

  function block(b) {
    switch (b.type) {
      case 'defs':
        return el('div', { class: 'aca-defs' }, b.items.map(function (d) {
          return el('div', { class: 'aca-def' }, [el('b', { text: d[0] }), d[1]]);
        }));
      case 'formula':
        return el('p', { class: 'aca-formula', text: b.text });
      case 'list':
        return el('ul', { class: 'aca-list' }, b.items.map(function (t) { return el('li', { text: t }); }));
      case 'steps':
        return el('ol', { class: 'aca-rules' }, b.items.map(function (t) { return el('li', { text: t }); }));
      case 'table':
        return tableBlock(b.head, b.rows);
      default:
        return el('p', { text: b.text || '' });
    }
  }

  function numericColumns(head) {
    var cols = [];
    head.forEach(function (h, i) { if (/montant|entrée|sortie|solde|fcfa/i.test(h)) cols.push(i); });
    return cols;
  }

  /* ---------- vidéo ---------- */
  function videoSection(v) {
    var frame;
    if (v.url) {
      var yt = v.url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
      frame = yt
        ? el('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + yt[1], title: 'Vidéo du module', allow: 'encrypted-media; picture-in-picture', allowfullscreen: true, loading: 'lazy' })
        : el('video', { src: v.url, controls: true, preload: 'none' });
    } else {
      frame = el('div', { class: 'aca-video-empty' }, [el('p', null, ['La vidéo de ce module arrive bientôt.', el('br'), 'En attendant, lisez son script ci-dessous.'])]);
    }
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Vidéo (' + v.duration + ')' }),
      el('div', { class: 'aca-video' }, [frame]),
      el('details', null, [
        el('summary', { text: 'Lire le script de la vidéo' }),
        tableBlock(['Temps', 'Narration', 'Visuel'], v.script)
      ])
    ]);
  }

  /* ---------- outils pratiques ---------- */
  function field(label, value, onInput, extra) {
    var input = el('input', Object.assign({ type: 'number', inputmode: 'numeric', min: '0', step: 'any', value: String(value), oninput: onInput }, extra || {}));
    return { wrap: el('label', null, [label, input]), input: input };
  }

  function toolBenefice(d) {
    d = d || {};
    var f = {
      sacs: field('Sacs vendus', d.sacs || 0, update),
      prix: field('Prix d’un sac (FCFA)', d.prix || 0, update),
      dep: field('Total des dépenses (FCFA)', d.depenses || 0, update)
    };
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail]);
    function update() {
      var rec = num(f.sacs.input.value) * num(f.prix.input.value);
      var dep = num(f.dep.input.value);
      var b = rec - dep;
      var sacs = num(f.sacs.input.value);
      result.className = 'aca-result ' + (b >= 0 ? 'is-gain' : 'is-loss');
      big.textContent = (b >= 0 ? 'Bénéfice : ' : 'Perte : ') + money(Math.abs(b));
      detail.textContent = 'Recettes ' + money(rec) + ' − dépenses ' + money(dep) + '.' +
        (sacs > 0 ? ' Pour ne rien perdre, chaque sac doit se vendre au moins ' + money(dep / sacs) + '.' : '');
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculette : mon bénéfice' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Les valeurs de départ sont celles d’Aminatou. Remplacez-les par les vôtres.' }),
        el('div', { class: 'aca-fields' }, [f.sacs.wrap, f.prix.wrap, f.dep.wrap]),
        result
      ])
    ]);
  }

  function toolCaisse(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_caisse';
    var data = store.get(KEY, { start: 0, lines: [] });
    var startF = field('Solde de départ (FCFA)', data.start, function () { data.start = num(startF.input.value); save(); });
    var dateI = el('input', { type: 'text', placeholder: 'jj/mm', 'aria-label': 'Date', maxlength: '10' });
    var labelI = el('input', { type: 'text', placeholder: 'Ex. vente de 3 sacs', 'aria-label': 'Libellé', maxlength: '80' });
    var amountI = el('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: 'Montant', 'aria-label': 'Montant en FCFA' });
    var kindS = el('select', { 'aria-label': 'Type d’opération' }, [
      el('option', { value: 'in', text: 'Entrée' }),
      el('option', { value: 'out', text: 'Sortie (activité)' }),
      el('option', { value: 'perso', text: 'Sortie personnelle' })
    ]);
    var tableHolder = el('div');
    var totals = el('div', { class: 'aca-cash-totals', 'aria-live': 'polite' });
    var msg = el('p', { class: 'aca-note', 'aria-live': 'polite' });

    function save() { store.set(KEY, data); render(); }
    function add() {
      var amount = num(amountI.value);
      if (!labelI.value.trim() || amount <= 0) { msg.textContent = 'Indiquez un libellé et un montant supérieur à zéro.'; return; }
      data.lines.push({ d: dateI.value.trim(), l: labelI.value.trim(), a: amount, k: kindS.value });
      labelI.value = ''; amountI.value = ''; msg.textContent = 'Opération ajoutée.';
      save(); labelI.focus();
    }
    function render() {
      var solde = num(data.start), tin = 0, tout = 0, tperso = 0;
      var rows = data.lines.map(function (ln, i) {
        if (ln.k === 'in') { solde += ln.a; tin += ln.a; }
        else { solde -= ln.a; if (ln.k === 'perso') tperso += ln.a; else tout += ln.a; }
        var del = el('button', { type: 'button', class: 'aca-link', text: 'Retirer', 'aria-label': 'Retirer ' + ln.l, onclick: function () { data.lines.splice(i, 1); msg.textContent = 'Opération retirée.'; save(); } });
        return el('tr', { class: ln.k === 'perso' ? 'is-personal' : null }, [
          el('td', { text: ln.d || '—' }),
          el('td', { text: ln.l + (ln.k === 'perso' ? ' (personnel)' : '') }),
          el('td', { class: 'num', text: ln.k === 'in' ? fmt.format(ln.a) : '' }),
          el('td', { class: 'num', text: ln.k !== 'in' ? fmt.format(ln.a) : '' }),
          el('td', { class: 'num', text: fmt.format(solde) }),
          el('td', null, [del])
        ]);
      });
      tableHolder.textContent = '';
      if (!rows.length) {
        tableHolder.appendChild(el('p', { class: 'aca-empty', text: 'Votre cahier est vide. Ajoutez votre première opération ci-dessus.' }));
      } else {
        tableHolder.appendChild(el('div', { class: 'aca-table-wrap' }, [el('table', null, [
          el('thead', null, [el('tr', null, ['Date', 'Libellé', 'Entrée', 'Sortie', 'Solde', ''].map(function (h, i) {
            return el('th', { scope: 'col', class: i > 1 && i < 5 ? 'num' : null, text: h });
          }))]),
          el('tbody', null, rows)
        ])]));
      }
      totals.textContent = '';
      [['Entrées', tin], ['Dépenses de l’activité', tout], ['Sorties personnelles', tperso], ['Solde en caisse', solde]].forEach(function (t) {
        totals.appendChild(el('div', null, [t[0], el('b', { text: money(t[1]) })]));
      });
    }
    function clearAll() {
      if (!window.confirm('Effacer toutes les opérations de ce cahier ?')) return;
      data = { start: 0, lines: [] }; startF.input.value = '0'; msg.textContent = 'Cahier effacé.'; save();
    }
    function loadExample() {
      if (!d.exemple) return;
      data = JSON.parse(JSON.stringify(d.exemple));
      startF.input.value = String(data.start); msg.textContent = 'Exemple d’Aminatou chargé.'; save();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Mon cahier de caisse' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Votre cahier reste enregistré sur ce téléphone, même sans connexion.' }),
        el('div', { class: 'aca-fields' }, [startF.wrap]),
        el('div', { class: 'aca-cash-form' }, [
          el('label', { class: 'aca-f-date' }, ['Date', dateI]), el('label', { class: 'aca-f-amount' }, ['Montant (FCFA)', amountI]),
          el('label', { class: 'aca-f-label' }, ['Libellé', labelI]), el('label', { class: 'aca-f-kind' }, ['Type', kindS])
        ]),
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn', text: 'Ajouter l’opération', onclick: add }),
          el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Voir l’exemple d’Aminatou', onclick: loadExample }),
          el('button', { type: 'button', class: 'aca-link', text: 'Effacer le cahier', onclick: clearAll })
        ]),
        msg, totals, tableHolder
      ])
    ]);
  }

  function toolCout(d) {
    d = d || {};
    var f = {
      dep: field('Dépenses payées (FCFA)', d.depenses || 0, update),
      jours: field('Journées de travail familial', d.jours || 0, update),
      tarif: field('Tarif local d’une journée (FCFA)', d.tarifJournee || 0, update),
      mat: field('Prix du matériel (FCFA)', d.prixMateriel || 0, update),
      ans: field('Années d’utilisation', d.annees || 1, update, { min: '1' }),
      sacs: field('Sacs produits au total', d.sacs || 1, update, { min: '1' }),
      prix: field('Prix proposé par l’acheteur (FCFA)', d.prixPropose || 0, update)
    };
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var verdict = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail, verdict]);
    var floorMark = el('span', { class: 'aca-mark is-floor' });
    var priceMark = el('span', { class: 'aca-mark is-price' });
    var line = el('div', { class: 'aca-waterline', 'aria-hidden': 'true' }, [el('div', { class: 'aca-waterline-track' }), floorMark, priceMark]);

    function update() {
      var familial = num(f.jours.input.value) * num(f.tarif.input.value);
      var usure = num(f.mat.input.value) / Math.max(1, num(f.ans.input.value));
      var total = num(f.dep.input.value) + familial + usure;
      var sacs = Math.max(1, num(f.sacs.input.value));
      var cout = total / sacs;
      var prix = num(f.prix.input.value);
      var ecart = prix - cout;
      big.textContent = 'Coût par sac : ' + money(cout);
      detail.textContent = 'Coût total ' + money(total) + ' (dont travail familial ' + money(familial) + ' et usure ' + money(usure) + '), divisé par ' + fmt.format(sacs) + ' sacs.';
      if (prix > 0) {
        verdict.textContent = ecart >= 0
          ? 'À ' + money(prix) + ', vous gagnez environ ' + money(ecart) + ' par sac.'
          : 'À ' + money(prix) + ', vous perdez environ ' + money(-ecart) + ' par sac. Négociez ou attendez.';
        result.className = 'aca-result ' + (ecart >= 0 ? 'is-gain' : 'is-loss');
      } else {
        verdict.textContent = 'Indiquez le prix proposé pour savoir si vous gagnez ou perdez.';
        result.className = 'aca-result';
      }
      // Échelle : de 0 à 2 fois le plus grand des deux montants.
      var max = Math.max(cout, prix, 1) * 1.4;
      var pf = Math.min(96, Math.max(4, cout / max * 100));
      var pp = Math.min(96, Math.max(4, prix / max * 100));
      line.style.setProperty('--floor', pf + '%');
      line.classList.toggle('is-loss', prix > 0 && ecart < 0);
      floorMark.style.left = pf + '%'; floorMark.textContent = 'Coût ' + fmt.format(cout);
      priceMark.style.left = pp + '%'; priceMark.textContent = 'Prix ' + fmt.format(prix);
      priceMark.style.display = prix > 0 ? '' : 'none';
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculette : mon prix plancher' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Les valeurs de départ sont celles d’Aminatou. Remplacez-les par les vôtres.' }),
        el('div', { class: 'aca-fields' }, Object.keys(f).map(function (k) { return f[k].wrap; })),
        result, line
      ])
    ]);
  }

  function toolPrix(d) {
    d = d || {};
    var f = {
      cout: field('Mon coût par sac (FCFA)', d.cout || 0, update),
      marge: field('Marge souhaitée (%)', d.marge || 0, update),
      prix: field('Prix proposé par l’acheteur (FCFA)', d.prixPropose || 0, update)
    };
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var verdict = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail, verdict]);
    function update() {
      var cout = num(f.cout.input.value), vise = cout * (1 + num(f.marge.input.value) / 100), prix = num(f.prix.input.value);
      big.textContent = 'Prix visé : ' + money(vise);
      detail.textContent = 'Prix plancher ' + money(cout) + ' + marge de ' + fmt.format(num(f.marge.input.value)) + ' %.';
      if (prix <= 0) { verdict.textContent = 'Indiquez le prix proposé pour savoir quoi faire.'; result.className = 'aca-result'; return; }
      if (prix < cout) { verdict.textContent = 'À ' + money(prix) + ', vous perdez ' + money(cout - prix) + ' par sac : négociez, cherchez un autre acheteur ou attendez si le produit se conserve.'; result.className = 'aca-result is-loss'; }
      else if (prix < vise) { verdict.textContent = 'À ' + money(prix) + ', vous couvrez vos coûts (+' + money(prix - cout) + ' par sac) sans atteindre votre prix visé : vendez une partie, négociez le reste.'; result.className = 'aca-result'; }
      else { verdict.textContent = 'À ' + money(prix) + ', vous dépassez votre prix visé : vous pouvez vendre.'; result.className = 'aca-result is-gain'; }
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculette : mon prix de vente' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Les valeurs de départ sont celles d’Aminatou. Remplacez-les par les vôtres.' }),
        el('div', { class: 'aca-fields' }, [f.cout.wrap, f.marge.wrap, f.prix.wrap]), result
      ])
    ]);
  }

  function toolMarge(d) {
    d = d || {};
    var cultures = ['a', 'b'].map(function (k) {
      var c = d[k] || {};
      var name = el('input', { type: 'text', value: c.nom || '', maxlength: '30', oninput: update });
      return {
        name: name,
        cout: field('Coût par sac (FCFA)', c.cout || 0, update),
        prix: field('Prix de vente (FCFA)', c.prix || 0, update),
        sacs: field('Sacs par hectare', c.sacsHa || 0, update),
        out: el('p', { class: 'aca-note' })
      };
    });
    var verdict = el('p', { class: 'aca-result-big' });
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [verdict]);
    function update() {
      var parHa = cultures.map(function (c) {
        var cout = num(c.cout.input.value), marge = num(c.prix.input.value) - cout, ha = marge * num(c.sacs.input.value);
        c.out.textContent = 'Marge par sac ' + money(marge) + (cout > 0 ? ' (' + fmt.format(marge / cout * 100) + ' %)' : '') + ' · par hectare ' + money(ha);
        return ha;
      });
      var n = cultures.map(function (c) { return c.name.value.trim() || 'Culture'; });
      if (parHa[0] === parHa[1]) verdict.textContent = 'Les deux cultures rapportent autant par hectare.';
      else { var w = parHa[0] > parHa[1] ? 0 : 1; verdict.textContent = n[w] + ' rapporte ' + money(Math.abs(parHa[0] - parHa[1])) + ' de plus par hectare.'; }
      result.className = 'aca-result ' + (Math.max(parHa[0], parHa[1]) >= 0 ? 'is-gain' : 'is-loss');
    }
    update();
    var cols = cultures.map(function (c, i) {
      return el('div', { class: 'aca-culture' }, [
        el('label', null, ['Culture ' + (i + 1), c.name]),
        el('div', { class: 'aca-fields' }, [c.cout.wrap, c.prix.wrap, c.sacs.wrap]), c.out
      ]);
    });
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Comparateur : deux cultures' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Comparez la marge par hectare, pas seulement le prix. Les chiffres de départ sont fictifs.' }),
        el('div', { class: 'aca-cultures' }, cols), result
      ])
    ]);
  }

  function toolBudget(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_budget';
    var data = store.get(KEY, null) || { reserve: (d.reserve != null ? d.reserve : 10), postes: (d.postes || []).map(function (p) { return { n: p[0], p: p[1], r: '' }; }) };
    var holder = el('div');
    var totals = el('div', { class: 'aca-cash-totals', 'aria-live': 'polite' });
    var reserveF = field('Réserve pour imprévus (%)', data.reserve, function () { data.reserve = num(reserveF.input.value); save(false); });
    function save(redraw) { store.set(KEY, data); if (redraw) render(); else sums(); }
    function sums() {
      var prevu = 0, reel = 0, prevuRens = 0, hasReel = false;
      data.postes.forEach(function (p) { prevu += num(p.p); if (p.r !== '') { reel += num(p.r); prevuRens += num(p.p); hasReel = true; } });
      var ecart = reel - prevuRens;
      var reserve = prevu * num(data.reserve) / 100;
      totals.textContent = '';
      [['Dépenses prévues', money(prevu)], ['Réserve', money(reserve)], ['Budget total', money(prevu + reserve)],
       ['Dépenses réelles', hasReel ? money(reel) : '—'], ['Écart sur les postes remplis', hasReel ? (ecart > 0 ? '+' : '') + money(ecart) : '—']].forEach(function (t) {
        totals.appendChild(el('div', null, [t[0], el('b', { text: t[1] })]));
      });
      data.postes.forEach(function (p, i) {
        var cell = holder.querySelector('[data-ecart="' + i + '"]');
        if (!cell) return;
        var e = num(p.r) - num(p.p);
        cell.textContent = p.r === '' ? '—' : (e > 0 ? '+' : '') + fmt.format(e);
        cell.className = 'num' + (p.r !== '' && e > 0 ? ' is-over' : '');
      });
    }
    function render() {
      holder.textContent = '';
      var rows = data.postes.map(function (p, i) {
        var n = el('input', { type: 'text', value: p.n, 'aria-label': 'Poste', maxlength: '40', oninput: function () { p.n = n.value; save(false); } });
        var pv = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: String(p.p), 'aria-label': 'Prévu pour ' + p.n, oninput: function () { p.p = num(pv.value); save(false); } });
        var rv = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: p.r === '' ? '' : String(p.r), placeholder: 'à remplir', 'aria-label': 'Réel pour ' + p.n, oninput: function () { p.r = rv.value === '' ? '' : num(rv.value); save(false); } });
        return el('tr', null, [el('td', { 'data-label': 'Poste' }, [n]), el('td', { 'data-label': 'Prévu (FCFA)' }, [pv]), el('td', { 'data-label': 'Réel (FCFA)' }, [rv]), el('td', { 'data-ecart': String(i), 'data-label': 'Écart', class: 'num' }),
          el('td', { class: 'aca-budget-del' }, [el('button', { type: 'button', class: 'aca-link', text: 'Retirer', 'aria-label': 'Retirer ' + p.n, onclick: function () { data.postes.splice(i, 1); save(true); } })])]);
      });
      holder.appendChild(el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-budget' }, [
        el('thead', null, [el('tr', null, ['Poste', 'Prévu (FCFA)', 'Réel (FCFA)', 'Écart', ''].map(function (h, i) { return el('th', { scope: 'col', class: i === 3 ? 'num' : null, text: h }); }))]),
        el('tbody', null, rows)
      ])]));
      sums();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Mon budget de saison' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Remplissez le prévu avant les semis, puis le réel au fil de la saison. Votre budget reste enregistré sur ce téléphone.' }),
        el('div', { class: 'aca-fields' }, [reserveF.wrap]),
        holder,
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Ajouter un poste', onclick: function () { data.postes.push({ n: 'Nouveau poste', p: 0, r: '' }); save(true); } }),
          el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
            if (!window.confirm('Remplacer votre budget par l’exemple de départ ?')) return;
            data = { reserve: (d.reserve != null ? d.reserve : 10), postes: (d.postes || []).map(function (p) { return { n: p[0], p: p[1], r: '' }; }) };
            reserveF.input.value = String(data.reserve); save(true);
          }})
        ]),
        totals
      ])
    ]);
  }

  function toolTresorerie(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_tresorerie';
    function fresh() { return { start: d.start || 0, mois: (d.mois || []).map(function (m) { return { n: m[0], e: m[1], s: m[2] }; }) }; }
    var data = store.get(KEY, null) || fresh();
    var startF = field('Argent disponible au départ (FCFA)', data.start, function () { data.start = num(startF.input.value); save(false); });
    var holder = el('div');
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail]);
    function save(redraw) { store.set(KEY, data); if (redraw) render(); else sums(); }
    function sums() {
      var solde = num(data.start), low = Infinity, lowName = '';
      data.mois.forEach(function (m, i) {
        solde += num(m.e) - num(m.s);
        if (solde < low) { low = solde; lowName = m.n; }
        var cell = holder.querySelector('[data-solde="' + i + '"]');
        if (cell) { cell.textContent = fmt.format(solde); cell.className = 'num' + (solde < 0 ? ' is-over' : ''); }
      });
      if (!data.mois.length) { big.textContent = 'Ajoutez vos mois.'; detail.textContent = ''; result.className = 'aca-result'; return; }
      if (low < 0) {
        big.textContent = 'Il manque ' + money(-low) + ' en ' + lowName.toLowerCase();
        detail.textContent = 'C’est votre point le plus bas. Préparez dès maintenant une solution : réserve, achat groupé, petite activité, ou emprunt avec un plan.';
        result.className = 'aca-result is-loss';
      } else {
        big.textContent = 'Pas de manque prévu';
        detail.textContent = 'Votre point le plus bas est de ' + money(low) + ' en ' + lowName.toLowerCase() + '. Solde final : ' + money(solde) + '.';
        result.className = 'aca-result is-gain';
      }
    }
    function render() {
      holder.textContent = '';
      var rows = data.mois.map(function (m, i) {
        var n = el('input', { type: 'text', value: m.n, maxlength: '20', 'aria-label': 'Mois', oninput: function () { m.n = n.value; save(false); } });
        var e = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: String(m.e), 'aria-label': 'Entrées ' + m.n, oninput: function () { m.e = num(e.value); save(false); } });
        var so = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: String(m.s), 'aria-label': 'Sorties ' + m.n, oninput: function () { m.s = num(so.value); save(false); } });
        return el('tr', null, [el('td', { 'data-label': 'Mois' }, [n]), el('td', { 'data-label': 'Entrées (FCFA)' }, [e]), el('td', { 'data-label': 'Sorties (FCFA)' }, [so]),
          el('td', { 'data-solde': String(i), 'data-label': 'Solde fin de mois', class: 'num' }),
          el('td', { class: 'aca-budget-del' }, [el('button', { type: 'button', class: 'aca-link', text: 'Retirer', 'aria-label': 'Retirer ' + m.n, onclick: function () { data.mois.splice(i, 1); save(true); } })])]);
      });
      holder.appendChild(el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-budget' }, [
        el('thead', null, [el('tr', null, ['Mois', 'Entrées (FCFA)', 'Sorties (FCFA)', 'Solde', ''].map(function (h, i) { return el('th', { scope: 'col', class: i === 3 ? 'num' : null, text: h }); }))]),
        el('tbody', null, rows)])]));
      sums();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Mon plan de trésorerie' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Les valeurs de départ sont celles d’Aminatou. Remplacez-les par vos prévisions ; elles restent enregistrées sur ce téléphone.' }),
        el('div', { class: 'aca-fields' }, [startF.wrap]),
        result, holder,
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Ajouter un mois', onclick: function () { data.mois.push({ n: 'Mois ' + (data.mois.length + 1), e: 0, s: 0 }); save(true); } }),
          el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
            if (!window.confirm('Remplacer votre plan par l’exemple de départ ?')) return;
            data = fresh(); startF.input.value = String(data.start); save(true);
          }})
        ])
      ])
    ]);
  }

  function toolRemboursement(d) {
    d = d || {};
    var f = {
      montant: field('Montant emprunté (FCFA)', d.montant || 0, update),
      taux: field('Intérêts et frais (%)', d.taux || 0, update),
      solde: field('Solde prévu au moment de rembourser (FCFA)', d.solde || 0, update)
    };
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail]);
    function update() {
      var total = num(f.montant.input.value) * (1 + num(f.taux.input.value) / 100), reste = num(f.solde.input.value) - total;
      big.textContent = 'À rembourser : ' + money(total);
      detail.textContent = reste >= 0
        ? 'Après remboursement, il vous resterait ' + money(reste) + ', si vos prévisions se réalisent.'
        : 'Il manquerait ' + money(-reste) + ' au moment de rembourser : empruntez moins, ou revoyez votre budget et votre trésorerie.';
      result.className = 'aca-result ' + (reste >= 0 ? 'is-gain' : 'is-loss');
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculette : puis-je rembourser ?' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Le taux de départ est illustratif. Utilisez le taux et les frais réels donnés par écrit par l’institution.' }),
        el('div', { class: 'aca-fields' }, [f.montant.wrap, f.taux.wrap, f.solde.wrap]), result
      ])
    ]);
  }

  function toolPrompt(d) {
    d = d || {};
    function area(label, value, hint) {
      var t = el('textarea', { rows: '2', maxlength: '600', placeholder: hint, oninput: update });
      t.value = value || '';
      return { wrap: el('label', null, [label, t]), input: t };
    }
    var f = {
      role: area('Rôle : qui doit parler ?', d.role, 'Ex. Tu es conseiller agricole.'),
      contexte: area('Contexte : que doit savoir l’assistant ?', d.contexte, 'Ex. Je cultive 2 hectares de maïs près de Ngaoundéré.'),
      tache: area('Tâche : que faut-il produire ?', d.tache, 'Ex. Propose un calendrier de travaux.'),
      format: area('Format : sous quelle forme ?', d.format, 'Ex. Un tableau par mois, mots simples.')
    };
    var out = el('textarea', { class: 'aca-prompt-out', rows: '6', readonly: true, 'aria-label': 'Instruction complète' });
    var check = el('p', { class: 'aca-feedback', 'aria-live': 'polite' });
    var msg = el('p', { class: 'aca-note', 'aria-live': 'polite' });
    var names = { role: 'le rôle', contexte: 'le contexte', tache: 'la tâche', format: 'le format' };
    function update() {
      var parts = [], missing = [];
      Object.keys(f).forEach(function (k) {
        var v = f[k].input.value.trim();
        if (v) parts.push(v); else missing.push(names[k]);
      });
      out.value = parts.join('\n\n');
      if (!missing.length) { check.className = 'aca-feedback is-right'; check.textContent = 'Les quatre ingrédients sont là. Copiez l’instruction et collez-la dans l’assistant de votre choix.'; }
      else { check.className = 'aca-feedback is-wrong'; check.textContent = 'Il manque ' + missing.join(', ') + '.'; }
    }
    function copy() {
      var done = function () { msg.textContent = 'Instruction copiée.'; };
      var fallback = function () { out.focus(); out.select(); msg.textContent = 'Le texte est sélectionné : appuyez longuement dessus, puis choisissez « Copier ».'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(done, fallback); else fallback();
    }
    function clear() { Object.keys(f).forEach(function (k) { f[k].input.value = ''; }); update(); f.role.input.focus(); msg.textContent = ''; }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Générateur d’instructions' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Remplissez les quatre cases. L’exemple de départ est celui de Moussa.' }),
        el('div', { class: 'aca-prompt-fields' }, [f.role.wrap, f.contexte.wrap, f.tache.wrap, f.format.wrap]),
        el('div', { class: 'aca-result' }, [el('label', null, ['Votre instruction complète', out]), check]),
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn', text: 'Copier l’instruction', onclick: copy }),
          el('button', { type: 'button', class: 'aca-link', text: 'Vider les cases', onclick: clear })
        ]),
        msg
      ])
    ]);
  }

  function toolFiche(d) {
    d = d || {};
    var spec = [['produit', 'Produit et variété'], ['quantite', 'Quantité disponible'], ['conditionnement', 'Conditionnement'], ['qualite', 'Qualité'],
      ['prix', 'Prix'], ['lieu', 'Lieu de retrait ou livraison'], ['disponibilite', 'Disponibilité'], ['contact', 'Contact']];
    var inputs = {};
    var fields = spec.map(function (s) {
      var i = el('input', { type: 'text', maxlength: '120', oninput: update }); i.value = d[s[0]] || '';
      inputs[s[0]] = i; return el('label', null, [s[1], i]);
    });
    var card = el('div', { class: 'aca-fiche', 'aria-live': 'polite' });
    var out = el('textarea', { class: 'aca-prompt-out', rows: '8', readonly: true, 'aria-label': 'Texte à copier pour WhatsApp' });
    var check = el('p', { class: 'aca-feedback' });
    var msg = el('p', { class: 'aca-note', 'aria-live': 'polite' });
    function update() {
      var missing = [], lines = [];
      card.textContent = '';
      card.appendChild(el('p', { class: 'aca-fiche-title', text: inputs.produit.value.trim() || 'Votre produit' }));
      var dl = el('dl');
      spec.slice(1).forEach(function (s) {
        var v = inputs[s[0]].value.trim();
        if (!v) { missing.push(s[1].toLowerCase()); return; }
        dl.appendChild(el('dt', { text: s[1] })); dl.appendChild(el('dd', { text: v }));
        lines.push('• ' + s[1] + ' : ' + v);
      });
      if (!inputs.produit.value.trim()) missing.unshift('produit et variété');
      card.appendChild(dl);
      out.value = (inputs.produit.value.trim() ? '*' + inputs.produit.value.trim() + '*\n' : '') + lines.join('\n');
      if (missing.length) { check.className = 'aca-feedback is-wrong'; check.textContent = 'Il manque : ' + missing.join(', ') + '.'; }
      else { check.className = 'aca-feedback is-right'; check.textContent = 'Fiche complète. Relisez les chiffres, puis copiez le texte pour WhatsApp.'; }
    }
    function copy() {
      var done = function () { msg.textContent = 'Texte copié. Collez-le dans WhatsApp.'; };
      var fallback = function () { out.focus(); out.select(); msg.textContent = 'Le texte est sélectionné : appuyez longuement dessus, puis choisissez « Copier ».'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(done, fallback); else fallback();
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Générateur de fiche produit' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Remplissez les huit rubriques. L’exemple de départ est la fiche de Hawa.' }),
        el('div', { class: 'aca-fields aca-fields-wide' }, fields),
        el('p', { class: 'aca-note', text: 'Aperçu de votre fiche' }), card, check,
        el('label', null, ['Texte prêt pour WhatsApp', out]),
        el('div', { class: 'aca-cash-actions' }, [el('button', { type: 'button', class: 'aca-btn', text: 'Copier le texte', onclick: copy })]),
        msg
      ])
    ]);
  }

  function toolProspects(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_' + (d.key || 'prospects');
    var STATUTS = d.statuts || ['À contacter', 'Contacté', 'Intéressé', 'Échantillon envoyé', 'Commande', 'Refus'];
    var COLS = d.cols || ['Acheteur', 'Contact', 'Statut', 'Prochaine relance'];
    var data = store.get(KEY, null) || { list: JSON.parse(JSON.stringify(d.exemple || [])) };
    var holder = el('div');
    var summary = el('p', { class: 'aca-feedback', 'aria-live': 'polite' });
    function save(redraw) { store.set(KEY, data); if (redraw) render(); else sums(); }
    function sums() {
      var counts = STATUTS.map(function () { return 0; });
      data.list.forEach(function (p) { counts[p.s] = (counts[p.s] || 0) + 1; });
      summary.textContent = data.list.length + ' ' + (d.unit || 'contact') + (data.list.length > 1 ? 's' : '') + ' · ' +
        STATUTS.map(function (n, i) { return counts[i] ? counts[i] + ' ' + n.toLowerCase() : null; }).filter(Boolean).join(' · ');
    }
    function render() {
      holder.textContent = '';
      if (!data.list.length) { holder.appendChild(el('p', { class: 'aca-empty', text: d.emptyText || 'Aucun contact. Ajoutez votre premier acheteur.' })); sums(); return; }
      var rows = data.list.map(function (p, i) {
        var n = el('input', { type: 'text', value: p.n, maxlength: '60', 'aria-label': COLS[0], oninput: function () { p.n = n.value; save(false); } });
        var c = el('input', { type: 'text', value: p.c || '', maxlength: '60', 'aria-label': COLS[1], placeholder: d.placeholder || 'Nom, téléphone', oninput: function () { p.c = c.value; save(false); } });
        var st = el('select', { 'aria-label': 'Statut', onchange: function () { p.s = +st.value; save(false); } }, STATUTS.map(function (x, k) { return el('option', { value: String(k), text: x }); }));
        st.value = String(p.s || 0);
        var r = el('input', { type: 'date', value: p.r || '', 'aria-label': COLS[3], onchange: function () { p.r = r.value; save(false); } });
        return el('tr', null, [el('td', { 'data-label': COLS[0] }, [n]), el('td', { 'data-label': COLS[1] }, [c]), el('td', { 'data-label': COLS[2] }, [st]), el('td', { 'data-label': COLS[3] }, [r]),
          el('td', { class: 'aca-budget-del' }, [el('button', { type: 'button', class: 'aca-link', text: 'Retirer', 'aria-label': 'Retirer ' + p.n, onclick: function () { data.list.splice(i, 1); save(true); } })])]);
      });
      holder.appendChild(el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-budget' }, [
        el('thead', null, [el('tr', null, COLS.concat(['']).map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
        el('tbody', null, rows)])]));
      sums();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: d.heading || 'Mon tableau de prospection' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: d.intro || 'Notez chaque acheteur, son statut et la date de la prochaine relance. Le tableau reste enregistré sur ce téléphone.' }),
        summary, holder,
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn', text: d.addLabel || 'Ajouter un acheteur', onclick: function () { data.list.push({ n: d.newName || 'Nouvel acheteur', c: '', s: 0, r: '' }); save(true); } }),
          el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
            if (!window.confirm('Remplacer votre tableau par l’exemple de départ ?')) return;
            data = { list: JSON.parse(JSON.stringify(d.exemple || [])) }; save(true);
          }})
        ])
      ])
    ]);
  }

  function toolBon(d) {
    d = d || {};
    var rows = (d.champs || []).map(function (c) {
      var i = el('input', { type: 'text', maxlength: '160', oninput: update }); i.value = c[1] || '';
      return { label: c[0], input: i, wrap: el('label', null, [c[0], i]) };
    });
    var out = el('textarea', { class: 'aca-prompt-out', rows: '10', readonly: true, 'aria-label': 'Bon de commande à envoyer' });
    var check = el('p', { class: 'aca-feedback' });
    var msg = el('p', { class: 'aca-note', 'aria-live': 'polite' });
    function update() {
      var missing = [];
      var lines = rows.map(function (r) { var v = r.input.value.trim(); if (!v) missing.push(r.label.toLowerCase()); return v ? '• ' + r.label + ' : ' + v : null; }).filter(Boolean);
      out.value = '*' + (d.titre || 'BON DE COMMANDE') + '*' + (d.noDate ? '' : '\nDate : ' + new Date().toLocaleDateString('fr-FR')) + '\n\n' + lines.join('\n') + (d.fin ? '\n\n' + d.fin : '');
      check.className = 'aca-feedback ' + (missing.length ? 'is-wrong' : 'is-right');
      check.textContent = missing.length ? 'Il manque : ' + missing.join(', ') + '.' : (d.okText || 'Bon complet. Relisez les montants, puis copiez-le pour l’envoyer.');
    }
    function copy() {
      var done = function () { msg.textContent = 'Bon de commande copié.'; };
      var fallback = function () { out.focus(); out.select(); msg.textContent = 'Le texte est sélectionné : appuyez longuement dessus, puis choisissez « Copier ».'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(done, fallback); else fallback();
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: d.heading || 'Générateur de bon de commande' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: d.intro || 'Remplissez les rubriques. L’exemple de départ est la commande de la provenderie.' }),
        el('div', { class: 'aca-fields aca-fields-wide' }, rows.map(function (r) { return r.wrap; })),
        check, el('label', null, [d.outLabel || 'Texte prêt pour WhatsApp', out]),
        el('div', { class: 'aca-cash-actions' }, [el('button', { type: 'button', class: 'aca-btn', text: d.copyLabel || 'Copier le bon de commande', onclick: copy })]),
        msg
      ])
    ]);
  }

  function toolRepartition(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_repartition';
    function fresh() { return { prix: d.prix || 0, frais: d.frais || 0, membres: (d.membres || []).map(function (m) { return { n: m[0], s: m[1] }; }) }; }
    var data = store.get(KEY, null) || fresh();
    var prixF = field('Prix obtenu par sac (FCFA)', data.prix, function () { data.prix = num(prixF.input.value); save(false); });
    var fraisF = field('Frais par sac votés en assemblée (FCFA)', data.frais, function () { data.frais = num(fraisF.input.value); save(false); });
    var holder = el('div');
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail]);
    function save(redraw) { store.set(KEY, data); if (redraw) render(); else sums(); }
    function sums() {
      var net = num(data.prix) - num(data.frais), sacs = 0, total = 0;
      data.membres.forEach(function (m, i) {
        var due = num(m.s) * net; sacs += num(m.s); total += due;
        var cell = holder.querySelector('[data-due="' + i + '"]'); if (cell) cell.textContent = fmt.format(due);
      });
      big.textContent = 'Total à payer aux membres : ' + money(total);
      detail.textContent = fmt.format(sacs) + ' sacs · ' + money(net) + ' net par sac · frais retenus : ' + money(sacs * num(data.frais)) + '.';
      result.className = 'aca-result ' + (net >= 0 ? 'is-gain' : 'is-loss');
    }
    function render() {
      holder.textContent = '';
      var rows = data.membres.map(function (m, i) {
        var n = el('input', { type: 'text', value: m.n, maxlength: '50', 'aria-label': 'Membre', oninput: function () { m.n = n.value; save(false); } });
        var s = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: String(m.s), 'aria-label': 'Sacs de ' + m.n, oninput: function () { m.s = num(s.value); save(false); } });
        return el('tr', null, [el('td', { 'data-label': 'Membre' }, [n]), el('td', { 'data-label': 'Sacs déposés' }, [s]), el('td', { 'data-due': String(i), 'data-label': 'Montant dû (FCFA)', class: 'num' }),
          el('td', { class: 'aca-budget-del' }, [el('button', { type: 'button', class: 'aca-link', text: 'Retirer', 'aria-label': 'Retirer ' + m.n, onclick: function () { data.membres.splice(i, 1); save(true); } })])]);
      });
      holder.appendChild(el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-budget' }, [
        el('thead', null, [el('tr', null, ['Membre', 'Sacs déposés', 'Montant dû (FCFA)', ''].map(function (h, i) { return el('th', { scope: 'col', class: i === 2 ? 'num' : null, text: h }); }))]),
        el('tbody', null, rows)])]));
      sums();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculateur de répartition' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Saisissez le prix obtenu, les frais par sac et les sacs de chaque membre. Le décompte reste enregistré sur ce téléphone.' }),
        el('div', { class: 'aca-fields' }, [prixF.wrap, fraisF.wrap]),
        result, holder,
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Ajouter un membre', onclick: function () { data.membres.push({ n: 'Membre ' + (data.membres.length + 1), s: 0 }); save(true); } }),
          el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
            if (!window.confirm('Remplacer votre décompte par l’exemple de départ ?')) return;
            data = fresh(); prixF.input.value = String(data.prix); fraisF.input.value = String(data.frais); save(true);
          }})
        ])
      ])
    ]);
  }

  function toolPertes(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_pertes';
    function fresh() { return { recolte: d.recolte || 0, prix: d.prix || 0, etapes: (d.etapes || []).map(function (e) { return { n: e[0], s: e[1] }; }) }; }
    var data = store.get(KEY, null) || fresh();
    var rF = field('Sacs récoltés', data.recolte, function () { data.recolte = num(rF.input.value); save(); });
    var pF = field('Prix du sac (FCFA)', data.prix, function () { data.prix = num(pF.input.value); save(); });
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var worst = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail, worst]);
    var fields = data.etapes.map(function (e) {
      var f = field(e.n + ' : sacs perdus ou déclassés', e.s, function () { e.s = num(f.input.value); save(); });
      return f.wrap;
    });
    function save() { store.set(KEY, data); update(); }
    function update() {
      var lost = 0, w = null;
      data.etapes.forEach(function (e) { lost += num(e.s); if (!w || num(e.s) > num(w.s)) w = e; });
      var rec = num(data.recolte);
      var taux = rec > 0 ? lost / rec * 100 : 0;
      big.textContent = 'Taux de pertes : ' + fmt.format(Math.round(taux * 10) / 10) + ' %';
      detail.textContent = fmt.format(lost) + ' sacs perdus ou déclassés sur ' + fmt.format(rec) + ', soit ' + money(lost * num(data.prix)) + '.';
      worst.textContent = w && num(w.s) > 0 ? 'Étape à corriger en premier : ' + w.n.toLowerCase() + ' (' + fmt.format(num(w.s)) + ' sacs).' : '';
      result.className = 'aca-result ' + (taux > 5 ? 'is-loss' : 'is-gain');
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculateur de pertes' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Les valeurs de départ sont fictives. Remplacez-les par celles de votre dernière saison ; elles restent enregistrées sur ce téléphone.' }),
        el('div', { class: 'aca-fields' }, [rF.wrap, pF.wrap]),
        el('div', { class: 'aca-fields' }, fields),
        result,
        el('div', { class: 'aca-cash-actions' }, [el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
          if (!window.confirm('Remplacer vos chiffres par l’exemple de départ ?')) return;
          store.set(KEY, fresh()); msgReload();
        }})])
      ])
    ]);
    function msgReload() { window.location.reload(); }
  }

  function toolTransfo(d) {
    d = d || {};
    var f = {
      matiere: field('Matière première (kg)', d.matiere || 0, update),
      prixM: field('Prix de la matière (FCFA par kg)', d.prixMatiere || 0, update),
      rend: field('Rendement mesuré (%)', d.rendement || 0, update),
      lot: field('Autres coûts du lot : énergie, travail, transport (FCFA)', d.coutsLot || 0, update),
      taille: field('Taille d’une unité (kg)', d.tailleUnite || 1, update, { step: '0.05' }),
      emb: field('Emballage et étiquette par unité (FCFA)', d.emballage || 0, update),
      prix: field('Prix de vente d’une unité (FCFA)', d.prixVente || 0, update)
    };
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var verdict = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail, verdict]);
    function update() {
      var fini = num(f.matiere.input.value) * num(f.rend.input.value) / 100;
      var unites = Math.floor(fini / Math.max(0.001, num(f.taille.input.value)));
      var total = num(f.matiere.input.value) * num(f.prixM.input.value) + num(f.lot.input.value) + unites * num(f.emb.input.value);
      if (unites <= 0) { big.textContent = 'Indiquez la matière et le rendement.'; detail.textContent = ''; verdict.textContent = ''; result.className = 'aca-result'; return; }
      var cout = total / unites, prix = num(f.prix.input.value), m = prix - cout;
      big.textContent = 'Coût par unité : ' + money(cout);
      detail.textContent = fmt.format(Math.round(fini * 10) / 10) + ' kg de produit fini, soit ' + fmt.format(unites) + ' unités ; coût total du lot ' + money(total) + '.';
      verdict.textContent = prix > 0 ? (m >= 0 ? 'Au prix de ' + money(prix) + ', vous gagnez ' + money(m) + ' par unité, soit ' + money(m * unites) + ' par lot.' : 'Au prix de ' + money(prix) + ', vous perdez ' + money(-m) + ' par unité : revoyez le prix ou les coûts.') : '';
      result.className = 'aca-result ' + (prix > 0 ? (m >= 0 ? 'is-gain' : 'is-loss') : '');
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculateur de coût de transformation' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Les valeurs de départ sont celles du gari de Salamatou, fictives. Remplacez-les par vos chiffres mesurés.' }),
        el('div', { class: 'aca-fields' }, Object.keys(f).map(function (k) { return f[k].wrap; })),
        result
      ])
    ]);
  }

  function toolPackaging(d) {
    d = d || {};
    var coutF = field('Coût du produit, sans emballage (FCFA par unité)', d.cout || 0, update);
    var opts = ['a', 'b'].map(function (k) {
      var o = d[k] || {};
      var name = el('input', { type: 'text', maxlength: '40', oninput: update }); name.value = o.nom || '';
      return { name: name, emb: field('Coût de l’emballage (FCFA)', o.emb || 0, update), prix: field('Prix de vente constaté (FCFA)', o.prix || 0, update), out: el('p', { class: 'aca-note' }) };
    });
    var big = el('p', { class: 'aca-result-big' });
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big]);
    function update() {
      var c = num(coutF.input.value);
      var marges = opts.map(function (o) { var m = num(o.prix.input.value) - c - num(o.emb.input.value); o.out.textContent = 'Marge par unité : ' + money(m); return m; });
      var n = opts.map(function (o) { return o.name.value.trim() || 'Option'; });
      if (marges[0] === marges[1]) { big.textContent = 'Les deux emballages laissent la même marge.'; result.className = 'aca-result'; return; }
      var w = marges[1] > marges[0] ? 1 : 0;
      big.textContent = n[w] + ' rapporte ' + money(Math.abs(marges[1] - marges[0])) + ' de plus par unité.';
      result.className = 'aca-result ' + (marges[w] >= 0 ? 'is-gain' : 'is-loss');
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Comparateur de packaging' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Comparez deux emballages pour le même produit. Utilisez des prix vérifiés par un test de vente. L’exemple de départ est fictif.' }),
        el('div', { class: 'aca-fields' }, [coutF.wrap]),
        el('div', { class: 'aca-cultures' }, opts.map(function (o, i) {
          return el('div', { class: 'aca-culture' }, [el('label', null, ['Emballage ' + (i + 1), o.name]), el('div', { class: 'aca-fields' }, [o.emb.wrap, o.prix.wrap]), o.out]);
        })),
        result
      ])
    ]);
  }

  function toolCanal(d) {
    d = d || {};
    var coutF = field('Coût par unité (FCFA)', d.cout || 0, update);
    var prixF = field('Prix public (FCFA)', d.prix || 0, update);
    var rows = (d.canaux || []).map(function (c) {
      var name = el('input', { type: 'text', maxlength: '40', 'aria-label': 'Canal', oninput: update }); name.value = c[0];
      var m = el('input', { type: 'number', inputmode: 'numeric', min: '0', max: '100', 'aria-label': 'Marge du distributeur en %', oninput: update }); m.value = String(c[1]);
      var net = el('td', { class: 'num', 'data-label': 'Pour le groupement (FCFA)' });
      var gain = el('td', { class: 'num', 'data-label': 'Gain par unité (FCFA)' });
      return { name: name, m: m, net: net, gain: gain, tr: el('tr', null, [el('td', { 'data-label': 'Canal' }, [name]), el('td', { 'data-label': 'Marge (%)' }, [m]), net, gain]) };
    });
    var verdict = el('p', { class: 'aca-feedback', 'aria-live': 'polite' });
    function update() {
      var c = num(coutF.input.value), pub = num(prixF.input.value), bad = [];
      rows.forEach(function (r) {
        var n = pub * (1 - num(r.m.value) / 100), g = n - c;
        r.net.textContent = fmt.format(n); r.gain.textContent = (g > 0 ? '+' : '') + fmt.format(g);
        r.gain.className = 'num' + (g <= 0 ? ' is-over' : '');
        if (g <= 0) bad.push(r.name.value.trim() || 'un canal');
      });
      verdict.className = 'aca-feedback ' + (bad.length ? 'is-wrong' : 'is-right');
      verdict.textContent = bad.length ? 'Pas de gain sur : ' + bad.join(', ') + '. Négociez la marge, changez de format ou renoncez à ce canal.' : 'Tous vos canaux laissent un gain.';
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculateur par canal de vente' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'L’exemple de départ est la pâte d’arachide de Salamatou, fictif. Remplacez par vos chiffres.' }),
        el('div', { class: 'aca-fields' }, [coutF.wrap, prixF.wrap]),
        el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-budget' }, [
          el('thead', null, [el('tr', null, ['Canal', 'Marge (%)', 'Pour le groupement', 'Gain par unité'].map(function (h, i) { return el('th', { scope: 'col', class: i > 1 ? 'num' : null, text: h }); }))]),
          el('tbody', null, rows.map(function (r) { return r.tr; }))])]),
        verdict
      ])
    ]);
  }

  function toolRisques(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_risques';
    function fresh() { return { list: (d.risques || []).map(function (r) { return { n: r[0], p: r[1], g: r[2] }; }) }; }
    var data = store.get(KEY, null) || fresh();
    var holder = el('div');
    var top = el('div', { class: 'aca-result', 'aria-live': 'polite' });
    function save(redraw) { store.set(KEY, data); if (redraw) render(); else sums(); }
    function level(sc) { return sc >= 6 ? 'Priorité' : sc >= 3 ? 'À surveiller' : 'Faible'; }
    function sums() {
      data.list.forEach(function (r, i) {
        var sc = num(r.p) * num(r.g), cell = holder.querySelector('[data-score="' + i + '"]');
        if (cell) { cell.textContent = sc + ' · ' + level(sc); cell.className = 'num' + (sc >= 6 ? ' is-over' : ''); }
      });
      var sorted = data.list.slice().sort(function (a, b) { return num(b.p) * num(b.g) - num(a.p) * num(a.g); });
      var prio = sorted.filter(function (r) { return num(r.p) * num(r.g) >= 6; });
      top.textContent = '';
      top.appendChild(el('p', { class: 'aca-result-big', text: prio.length ? prio.length + ' priorité' + (prio.length > 1 ? 's' : '') : 'Aucune priorité' }));
      top.appendChild(el('p', { text: prio.length ? 'À traiter d’abord : ' + prio.map(function (r) { return r.n.toLowerCase(); }).join(' ; ') + '.' : 'Aucun risque n’atteint un score de 6. Continuez à surveiller.' }));
      top.className = 'aca-result ' + (prio.length ? 'is-loss' : 'is-gain');
    }
    function sel(v, label, on) {
      var s = el('select', { 'aria-label': label, onchange: function () { on(+s.value); } }, [1, 2, 3].map(function (k) { return el('option', { value: String(k), text: String(k) }); }));
      s.value = String(v || 1); return s;
    }
    function render() {
      holder.textContent = '';
      var rows = data.list.map(function (r, i) {
        var n = el('input', { type: 'text', value: r.n, maxlength: '60', 'aria-label': 'Risque', oninput: function () { r.n = n.value; save(false); } });
        return el('tr', null, [el('td', { 'data-label': 'Risque' }, [n]),
          el('td', { 'data-label': 'Probabilité (1 à 3)' }, [sel(r.p, 'Probabilité', function (v) { r.p = v; save(false); })]),
          el('td', { 'data-label': 'Gravité (1 à 3)' }, [sel(r.g, 'Gravité', function (v) { r.g = v; save(false); })]),
          el('td', { 'data-score': String(i), 'data-label': 'Score', class: 'num' }),
          el('td', { class: 'aca-budget-del' }, [el('button', { type: 'button', class: 'aca-link', text: 'Retirer', 'aria-label': 'Retirer ' + r.n, onclick: function () { data.list.splice(i, 1); save(true); } })])]);
      });
      holder.appendChild(el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-budget' }, [
        el('thead', null, [el('tr', null, ['Risque', 'Probabilité', 'Gravité', 'Score', ''].map(function (h, i) { return el('th', { scope: 'col', class: i === 3 ? 'num' : null, text: h }); }))]),
        el('tbody', null, rows)])]));
      sums();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Ma matrice des risques' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Notez chaque risque de 1 à 3 pour la probabilité et la gravité. L’exemple de départ est celui de Hamadou ; votre matrice reste enregistrée sur ce téléphone.' }),
        top, holder,
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Ajouter un risque', onclick: function () { data.list.push({ n: 'Nouveau risque', p: 1, g: 1 }); save(true); } }),
          el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
            if (!window.confirm('Remplacer votre matrice par l’exemple de départ ?')) return;
            data = fresh(); save(true);
          }})
        ])
      ])
    ]);
  }

  function toolCapacite(d) {
    d = d || {};
    var f = {
      rec: field('Recettes par mois (FCFA)', d.recettes || 0, update),
      ch: field('Charges de l’activité par mois (FCFA)', d.charges || 0, update),
      fam: field('Dépenses de la famille par mois (FCFA)', d.famille || 0, update),
      aut: field('Autres remboursements par mois (FCFA)', d.autres || 0, update),
      mt: field('Montant à emprunter (FCFA)', d.montant || 0, update),
      cout: field('Coût total du crédit (%, à demander par écrit)', d.cout || 0, update),
      dur: field('Durée de remboursement (mois)', d.duree || 12, update, { min: '1' })
    };
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var verdict = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail, verdict]);
    function update() {
      var exc = num(f.rec.input.value) - num(f.ch.input.value) - num(f.fam.input.value) - num(f.aut.input.value);
      var total = num(f.mt.input.value) * (1 + num(f.cout.input.value) / 100);
      var mens = total / Math.max(1, num(f.dur.input.value));
      var prud = exc / 2;
      big.textContent = 'Mensualité : ' + money(mens);
      detail.textContent = 'Excédent mensuel ' + money(exc) + ' ; mensualité prudente au plus ' + money(Math.max(0, prud)) + ' ; total à rembourser ' + money(total) + '.';
      if (exc <= 0) { verdict.textContent = 'Votre excédent est nul ou négatif : aucun crédit n’est remboursable dans ces conditions.'; result.className = 'aca-result is-loss'; return; }
      if (mens <= prud) { verdict.textContent = 'La mensualité reste sous la moitié de votre excédent : c’est prudent, si vos prévisions sont réalistes.'; result.className = 'aca-result is-gain'; }
      else if (mens <= exc) { verdict.textContent = 'La mensualité dépasse la moitié de votre excédent : risqué. Empruntez moins, allongez la durée ou augmentez votre apport.'; result.className = 'aca-result'; }
      else { verdict.textContent = 'La mensualité dépasse votre excédent : vous ne pourrez pas rembourser. Revoyez le projet.'; result.className = 'aca-result is-loss'; }
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculette : capacité de remboursement' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Les valeurs de départ sont celles de Moussa, fictives. Le coût du crédit est illustratif : utilisez celui que l’établissement vous donne par écrit.' }),
        el('div', { class: 'aca-fields' }, Object.keys(f).map(function (k) { return f[k].wrap; })),
        result
      ])
    ]);
  }

  function toolChoix(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_choix';
    var crit = d.criteres || [];
    function fresh() { return { opts: (d.options || []).map(function (o) { return { n: o[0], s: o[1].slice() }; }) }; }
    var data = store.get(KEY, null) || fresh();
    var holder = el('div');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' });
    function save(redraw) { store.set(KEY, data); if (redraw) render(); else sums(); }
    function sums() {
      var best = -1, bestI = -1;
      data.opts.forEach(function (o, i) {
        var t = o.s.reduce(function (a, b) { return a + num(b); }, 0);
        var cell = holder.querySelector('[data-total="' + i + '"]'); if (cell) cell.textContent = String(t);
        if (t > best) { best = t; bestI = i; }
      });
      result.textContent = '';
      if (bestI < 0) return;
      var o = data.opts[bestI];
      var weak = crit.filter(function (c, k) { return num(o.s[k]) === 1; });
      result.appendChild(el('p', { class: 'aca-result-big', text: (o.n || 'Activité') + ' arrive en tête : ' + best + ' points' }));
      result.appendChild(el('p', { text: weak.length ? 'Attention : ' + weak.join(', ').toLowerCase() + ' noté 1. Vérifiez que ce point ne bloque pas tout, ou cherchez à le lever.' : 'Aucun critère bloquant pour cette activité.' }));
      result.className = 'aca-result ' + (weak.length ? '' : 'is-gain');
    }
    function sel(v, label, on) {
      var s = el('select', { 'aria-label': label, onchange: function () { on(+s.value); } }, [1, 2, 3].map(function (k) { return el('option', { value: String(k), text: String(k) }); }));
      s.value = String(v || 1); return s;
    }
    function render() {
      holder.textContent = '';
      var head = el('tr', null, [el('th', { scope: 'col', text: 'Critère' })].concat(data.opts.map(function (o, i) {
        var n = el('input', { type: 'text', value: o.n, maxlength: '40', 'aria-label': 'Activité ' + (i + 1), oninput: function () { o.n = n.value; save(false); } });
        return el('th', { scope: 'col' }, [n]);
      })));
      var rows = crit.map(function (c, k) {
        return el('tr', null, [el('th', { scope: 'row', text: c })].concat(data.opts.map(function (o) {
          return el('td', null, [sel(o.s[k], c + ' pour ' + o.n, function (v) { o.s[k] = v; save(false); })]);
        })));
      });
      rows.push(el('tr', { class: 'is-result' }, [el('th', { scope: 'row', text: 'Total' })].concat(data.opts.map(function (o, i) { return el('td', { class: 'num', 'data-total': String(i) }); }))));
      holder.appendChild(el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-grid' }, [el('thead', null, [head]), el('tbody', null, rows)])]));
      sums();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Ma grille de choix' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Notez chaque activité de 1 (défavorable) à 3 (favorable). L’exemple de départ est la grille de Rodrigue ; votre grille reste enregistrée sur ce téléphone.' }),
        holder, result,
        el('div', { class: 'aca-cash-actions' }, [el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
          if (!window.confirm('Remplacer votre grille par l’exemple de départ ?')) return;
          data = fresh(); save(true);
        }})])
      ])
    ]);
  }

  function toolCultures(formationId, d) {
    d = d || {};
    var KEY = 'aca_' + formationId + '_cultures';
    function fresh() { return { list: (d.cultures || []).map(function (c) { return { n: c[0], s: c[1], r: c[2], p: c[3], ch: c[4], pd: c[5] || 0 }; }) }; }
    var data = store.get(KEY, null) || fresh();
    var holder = el('div');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' });
    function save(redraw) { store.set(KEY, data); if (redraw) render(); else sums(); }
    function produit(c) { var calc = num(c.r) * num(c.p); return calc > 0 ? calc : num(c.pd); }
    function sums() {
      var best = null;
      data.list.forEach(function (c, i) {
        var m = produit(c) - num(c.ch), ha = num(c.s) > 0 ? m / num(c.s) : 0;
        var cell = holder.querySelector('[data-res="' + i + '"]');
        if (cell) cell.textContent = 'Produit ' + money(produit(c)) + ' · marge ' + money(m) + ' · par hectare ' + money(ha);
        if (num(c.s) > 0 && (!best || ha > best.ha)) best = { n: c.n, ha: ha };
      });
      result.textContent = '';
      if (best) {
        result.appendChild(el('p', { class: 'aca-result-big', text: (best.n || 'Culture') + ' : la meilleure marge par hectare' }));
        result.appendChild(el('p', { text: money(best.ha) + ' par hectare. Vérifiez aussi le travail, l’eau et les risques avant de décider.' }));
        result.className = 'aca-result ' + (best.ha >= 0 ? 'is-gain' : 'is-loss');
      }
    }
    function render() {
      holder.textContent = '';
      data.list.forEach(function (c, i) {
        var name = el('input', { type: 'text', value: c.n, maxlength: '40', oninput: function () { c.n = name.value; save(false); } });
        function f(label, key, opts) { var x = field(label, c[key], function () { c[key] = num(x.input.value); save(false); }, opts); return x.wrap; }
        holder.appendChild(el('div', { class: 'aca-culture' }, [
          el('label', null, ['Culture ' + (i + 1), name]),
          el('div', { class: 'aca-fields' }, [f('Surface (ha)', 's', { step: '0.1' }), f('Récolte (kg)', 'r'), f('Prix du kg (FCFA)', 'p'), f('Ou produit total (FCFA)', 'pd'), f('Charges totales (FCFA)', 'ch')]),
          el('p', { class: 'aca-note', 'data-res': String(i) }),
          el('button', { type: 'button', class: 'aca-link', text: 'Retirer cette culture', onclick: function () { data.list.splice(i, 1); save(true); } })
        ]));
      });
      sums();
    }
    render();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Le compte de mes cultures' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'Pour chaque culture, saisissez la récolte et le prix du kilo, ou directement le produit total pour les cultures vendues à la pièce. L’exemple de départ est celui de Marie-Claire ; vos chiffres restent enregistrés sur ce téléphone.' }),
        holder, result,
        el('div', { class: 'aca-cash-actions' }, [
          el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Ajouter une culture', onclick: function () { data.list.push({ n: 'Nouvelle culture', s: 1, r: 0, p: 0, ch: 0, pd: 0 }); save(true); } }),
          el('button', { type: 'button', class: 'aca-link', text: 'Revenir à l’exemple', onclick: function () {
            if (!window.confirm('Remplacer vos chiffres par l’exemple de départ ?')) return;
            data = fresh(); save(true);
          }})
        ])
      ])
    ]);
  }

  function toolScenarios(d) {
    d = d || {};
    var f = {
      prix: field('Prix de vente par unité (FCFA)', d.prix || 0, update),
      cout: field('Coût variable par unité (FCFA)', d.cout || 0, update),
      vol: field('Volume central par mois (unités)', d.volume || 0, update),
      fixes: field('Charges fixes du mois (FCFA)', d.fixes || 0, update)
    };
    var rows = [['Prudent (volume −30 %)', 0.7], ['Central', 1], ['Favorable (volume +20 %)', 1.2]].map(function (r) {
      return { label: r[0], k: r[1], vol: el('td', { class: 'num', 'data-label': 'Volume' }), res: el('td', { class: 'num', 'data-label': 'Résultat du mois' }) };
    });
    var note = el('p', { class: 'aca-feedback', 'aria-live': 'polite' });
    function update() {
      var m = num(f.prix.input.value) - num(f.cout.input.value);
      rows.forEach(function (r) {
        var v = Math.round(num(f.vol.input.value) * r.k), res = v * m - num(f.fixes.input.value);
        r.vol.textContent = fmt.format(v); r.res.textContent = money(res);
        r.res.className = 'num' + (res < 0 ? ' is-over' : '');
      });
      var prud = Math.round(num(f.vol.input.value) * 0.7) * m - num(f.fixes.input.value);
      note.className = 'aca-feedback ' + (prud >= 0 ? 'is-right' : 'is-wrong');
      note.textContent = 'Marge par unité : ' + money(m) + '. ' + (prud >= 0 ? 'Le scénario prudent reste positif.' : 'Le scénario prudent est négatif : revoyez prix, coûts ou charges avant de présenter le plan.') + ' Comparez ces résultats avec ceux de votre assistant.';
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculateur de scénarios' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'L’exemple de départ est celui de Grâce, fictif. Saisissez vos hypothèses pour vérifier les tableaux produits par l’IA.' }),
        el('div', { class: 'aca-fields' }, Object.keys(f).map(function (k) { return f[k].wrap; })),
        el('div', { class: 'aca-table-wrap' }, [el('table', { class: 'aca-budget' }, [
          el('thead', null, [el('tr', null, ['Scénario', 'Volume', 'Résultat du mois'].map(function (h, i) { return el('th', { scope: 'col', class: i ? 'num' : null, text: h }); }))]),
          el('tbody', null, rows.map(function (r) { return el('tr', null, [el('th', { scope: 'row', text: r.label }), r.vol, r.res]); }))])]),
        note
      ])
    ]);
  }

  function toolPub(d) {
    d = d || {};
    var f = {
      budget: field('Budget dépensé (FCFA)', d.budget || 0, update),
      clients: field('Nouveaux clients obtenus', d.clients || 0, update),
      marge: field('Marge par achat (FCFA)', d.marge || 0, update),
      achats: field('Achats prévus par client', d.achats || 1, update)
    };
    var big = el('p', { class: 'aca-result-big' });
    var detail = el('p');
    var result = el('div', { class: 'aca-result', 'aria-live': 'polite' }, [big, detail]);
    function update() {
      var c = num(f.clients.input.value);
      if (c <= 0) { big.textContent = 'Aucun nouveau client : la publicité n’est pas rentable.'; detail.textContent = 'Revoyez l’objectif, la cible ou le message avant de dépenser à nouveau.'; result.className = 'aca-result is-loss'; return; }
      var cout = num(f.budget.input.value) / c, valeur = num(f.marge.input.value) * num(f.achats.input.value);
      big.textContent = valeur > cout ? 'Rentable' : 'Pas rentable';
      detail.textContent = 'Coût d’un nouveau client : ' + money(cout) + ' ; valeur d’un client : ' + money(valeur) + '. ' + (valeur > cout ? 'Vous pouvez continuer, en surveillant ce coût.' : 'Arrêtez ou changez la publicité avant de dépenser à nouveau.');
      result.className = 'aca-result ' + (valeur > cout ? 'is-gain' : 'is-loss');
    }
    update();
    return el('section', { class: 'aca-section' }, [
      el('h3', { text: 'Calculateur de rentabilité publicitaire' }),
      el('div', { class: 'aca-tool' }, [
        el('p', { class: 'aca-tool-intro', text: 'L’exemple de départ est le deuxième essai de Nadège, fictif. Comptez vos nouveaux clients en leur demandant comment ils vous ont connus.' }),
        el('div', { class: 'aca-fields' }, Object.keys(f).map(function (k) { return f[k].wrap; })),
        result
      ])
    ]);
  }

  /* ---------- activités ---------- */
  function activitySection(a, formationId, moduleId) {
    var body;
    // Mode serveur : le corrigé n'est pas dans la page, le serveur vérifie chaque réponse.
    var serverCheck = SERVER && a.type !== 'checklist' && formationId && (a.type === 'answer' ? a.answer === undefined : (a.items && a.items[0] && a.items[0].length < 2));
    function ask(params) { return api('activity', Object.assign({ formation: formationId, module: moduleId }, params)); }
    var offline = 'Vérification impossible pour le moment. Vérifiez votre connexion, puis réessayez.';
    if (a.type === 'classify') {
      var picks = a.items.map(function () { return null; });
      var itemsEls = a.items.map(function (it, i) {
        var fb = el('p', { class: 'aca-feedback', 'aria-live': 'polite' });
        var btns = a.choices.map(function (c, ci) {
          return el('button', { type: 'button', class: 'aca-choice', 'aria-pressed': 'false', text: c, onclick: function () {
            picks[i] = ci;
            btns.forEach(function (b, bi) { b.setAttribute('aria-pressed', bi === ci ? 'true' : 'false'); b.classList.remove('is-right', 'is-wrong'); });
            function showResult(ok, right) {
              if (picks[i] !== ci) return; // un autre choix a été fait entre-temps
              btns[ci].classList.add(ok ? 'is-right' : 'is-wrong');
              fb.className = 'aca-feedback ' + (ok ? 'is-right' : 'is-wrong');
              fb.textContent = ok ? 'Juste.' : 'Pas tout à fait : la bonne réponse est « ' + a.choices[right] + ' ».';
            }
            if (serverCheck) {
              fb.className = 'aca-feedback'; fb.textContent = 'Vérification…';
              ask({ item: i, pick: ci }).then(function (r) { showResult(!!r.correct, r.answer); })
                .catch(function (e) { if (picks[i] === ci) { fb.className = 'aca-feedback is-wrong'; fb.textContent = e && e.status === 429 ? e.message : offline; } });
            } else {
              showResult(ci === it[1], it[1]);
            }
          }});
        });
        return el('div', { class: 'aca-item' }, [el('p', { class: 'aca-item-q', text: it[0] }), el('div', { class: 'aca-choices', role: 'group', 'aria-label': it[0] }, btns), fb]);
      });
      body = [el('p', { text: a.text })].concat(itemsEls);
    } else {
      var input = el('input', { type: 'number', inputmode: 'numeric', min: '0' });
      var fb = el('p', { class: 'aca-feedback', 'aria-live': 'polite' });
      body = [
        el('p', { text: a.text }),
        el('div', { class: 'aca-answer-row' }, [
          el('label', null, ['Votre réponse (' + (a.unit || 'FCFA') + ')', input]),
          el('button', { type: 'button', class: 'aca-btn', text: 'Vérifier', onclick: function () {
            if (input.value === '') { fb.className = 'aca-feedback is-wrong'; fb.textContent = 'Saisissez votre réponse avant de vérifier.'; return; }
            if (serverCheck) {
              fb.className = 'aca-feedback'; fb.textContent = 'Vérification…';
              ask({ value: num(input.value) }).then(function (r) {
                fb.className = 'aca-feedback ' + (r.correct ? 'is-right' : 'is-wrong');
                fb.textContent = (r.correct ? 'Juste. ' : 'Pas encore. ') + (r.solution || '');
              }).catch(function (e) { fb.className = 'aca-feedback is-wrong'; fb.textContent = e && e.status === 429 ? e.message : offline; });
              return;
            }
            var ok = Math.abs(num(input.value) - a.answer) < 1;
            fb.className = 'aca-feedback ' + (ok ? 'is-right' : 'is-wrong');
            fb.textContent = (ok ? 'Juste. ' : 'Pas encore. ') + a.solution;
          }})
        ]),
        fb
      ];
    }
    if (a.type === 'checklist') {
      var CK = 'aca_checklist_' + (a.key || a.title), ticks = store.get(CK, {});
      var count = el('p', { class: 'aca-feedback', 'aria-live': 'polite' });
      var refresh = function () { var n = a.items.filter(function (x, i) { return ticks[i]; }).length; count.className = 'aca-feedback' + (n === a.items.length ? ' is-right' : ''); count.textContent = n + ' étape' + (n > 1 ? 's' : '') + ' faite' + (n > 1 ? 's' : '') + ' sur ' + a.items.length + (n === a.items.length ? '. Bravo, votre projet est prêt à être envoyé.' : '.'); };
      body = [el('p', { text: a.text }), el('ul', { class: 'aca-checklist' }, a.items.map(function (t, i) {
        var cb = el('input', { type: 'checkbox', onchange: function () { ticks[i] = cb.checked; store.set(CK, ticks); refresh(); } });
        cb.checked = !!ticks[i];
        return el('li', null, [el('label', null, [cb, el('span', { text: t })])]);
      })), count];
      refresh();
    }
    if (a.then) body.push(el('p', { class: 'aca-note', text: a.then }));
    return el('section', { class: 'aca-section' }, [el('h3', { text: 'Activité pratique : ' + lcFirst(a.title) })].concat(body));
  }

  /* ---------- quiz ---------- */
  function quizSection(mod, passMark, onPass, previous, formationId) {
    var picks = mod.quiz.map(function () { return null; });
    var groups = [];
    var score = el('div', { 'aria-live': 'polite' });
    var checkBtn = el('button', { type: 'button', class: 'aca-btn', text: 'Vérifier mes réponses', onclick: check });
    var retryBtn = el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Recommencer le quiz', onclick: reset, style: 'display:none' });

    var items = mod.quiz.map(function (q, qi) {
      var fb = el('p', { class: 'aca-feedback' });
      var btns = q.options.map(function (o, oi) {
        return el('button', { type: 'button', class: 'aca-choice', 'aria-pressed': 'false', text: o, onclick: function () {
          if (checkBtn.disabled) return;
          picks[qi] = oi;
          btns.forEach(function (b, bi) { b.setAttribute('aria-pressed', bi === oi ? 'true' : 'false'); });
        }});
      });
      groups.push({ btns: btns, fb: fb, q: q });
      return el('div', { class: 'aca-item' }, [
        el('p', { class: 'aca-item-q', text: (qi + 1) + '. ' + q.q }),
        el('div', { class: 'aca-choices', role: 'group', 'aria-label': 'Question ' + (qi + 1) }, btns),
        fb
      ]);
    });

    function apply(results, good, pass, extra) {
      groups.forEach(function (g, qi) {
        var r = results[qi], ok = !!r.correct;
        g.btns[r.answer].classList.add('is-right');
        if (!ok) g.btns[picks[qi]].classList.add('is-wrong');
        g.fb.className = 'aca-feedback ' + (ok ? 'is-right' : 'is-wrong');
        g.fb.textContent = (ok ? 'Juste. ' : 'Réponse attendue : ' + g.q.options[r.answer] + '. ') + (r.explain || '');
      });
      var anon = SERVER && !SESSION.loggedIn;
      score.className = 'aca-score ' + (pass ? 'is-pass' : 'is-fail');
      score.textContent = good + ' bonnes réponses sur ' + mod.quiz.length + '. ' +
        (pass ? (anon ? 'Module validé. Connectez-vous pour obtenir une attestation vérifiable.' : 'Module validé. Votre attestation est disponible juste en dessous.')
              : 'Il faut ' + Math.ceil(passMark * mod.quiz.length) + ' bonnes réponses pour valider. Relisez les explications et recommencez.');
      checkBtn.disabled = true; retryBtn.style.display = '';
      onPass(good, pass, extra || {});
    }
    function check() {
      if (picks.indexOf(null) > -1) { score.className = 'aca-score is-fail'; score.textContent = 'Répondez à toutes les questions avant de vérifier.'; return; }
      if (SERVER) {
        checkBtn.disabled = true; score.className = 'aca-score'; score.textContent = 'Correction en cours…';
        api('attempt', { formation: formationId, module: mod.id, answers: picks }).then(function (res) {
          apply(res.results, res.good, res.passed, res);
        }).catch(function (e) {
          checkBtn.disabled = false; score.className = 'aca-score is-fail';
          score.textContent = e && e.status === 429 ? e.message : 'La correction n’a pas pu être faite. Vérifiez votre connexion, puis appuyez de nouveau sur « Vérifier mes réponses ». Vos réponses sont gardées.';
        });
        return;
      }
      var good = 0, results = groups.map(function (g, qi) { var ok = picks[qi] === g.q.answer; if (ok) good++; return { correct: ok, answer: g.q.answer, explain: g.q.explain }; });
      apply(results, good, good / mod.quiz.length >= passMark);
    }
    function reset() {
      picks = picks.map(function () { return null; });
      groups.forEach(function (g) {
        g.btns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); b.classList.remove('is-right', 'is-wrong'); });
        g.fb.textContent = '';
      });
      score.textContent = ''; score.className = '';
      checkBtn.disabled = false; retryBtn.style.display = 'none';
    }

    var head = [el('h3', { text: 'Quiz du module' + (previous ? ' (déjà validé : ' + previous + '/' + mod.quiz.length + ')' : '') })];
    return el('section', { class: 'aca-section' }, head.concat(items, [el('div', { class: 'aca-cash-actions' }, [checkBtn, retryBtn]), score]));
  }

  /* ---------- attestations ---------- */
  var NAME_KEY = 'aca_learner_name';
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function longDate(iso) { var d = iso ? new Date(iso) : new Date(); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function makeCode(courseId, moduleId) {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '', rnd = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    for (var i = 0; i < 6; i++) out += abc[rnd[i] % abc.length];
    return ('ACA-' + courseId + '-' + moduleId + '-' + out).toUpperCase();
  }
  function slug(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }

  function wrapLines(ctx, text, maxW) {
    var words = String(text).split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawCertificate(c) {
    // c: {kind:'module'|'course', name, line1, line2, detail, date, code, issuer, site, signName, signRole}
    var W = 1754, H = 1240, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d'), F = '"Atkinson Hyperlegible", "Segoe UI", Roboto, Arial, sans-serif';
    var green = '#2F5233', maize = '#E8B330', ink = '#1F261F', muted = '#55604F';
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#F3F6F1'; x.fillRect(66, 66, W - 132, 146);
    x.strokeStyle = green; x.lineWidth = 14; x.strokeRect(36, 36, W - 72, H - 72);
    x.strokeStyle = maize; x.lineWidth = 3; x.strokeRect(64, 64, W - 128, H - 128);

    // Sceau
    x.beginPath(); x.arc(W - 230, 230, 92, 0, Math.PI * 2); x.fillStyle = green; x.fill();
    x.beginPath(); x.arc(W - 230, 230, 74, 0, Math.PI * 2); x.strokeStyle = maize; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#FFFFFF'; x.textAlign = 'center'; x.font = '700 54px ' + F; x.fillText('AC', W - 230, 248);

    x.textAlign = 'left'; x.fillStyle = green; x.font = '700 34px ' + F; x.fillText('AgroConnect Academy', 140, 150);
    x.fillStyle = ink; x.font = '700 84px ' + F;
    x.fillText(c.kind === 'course' ? 'Certificat de parcours' : 'Attestation de réussite', 140, 330);
    x.fillStyle = muted; x.font = '400 34px ' + F; x.fillText(c.kind === 'course' ? 'décerné à' : 'décernée à', 140, 420);

    x.fillStyle = green; var size = 96; x.font = '700 ' + size + 'px ' + F;
    while (x.measureText(c.name).width > W - 420 && size > 50) { size -= 4; x.font = '700 ' + size + 'px ' + F; }
    x.fillText(c.name, 140, 530);
    x.fillStyle = maize; x.fillRect(140, 560, 240, 8);

    x.fillStyle = ink; x.font = '400 38px ' + F;
    var y = 650;
    wrapLines(x, c.line1, W - 280).forEach(function (l) { x.fillText(l, 140, y); y += 54; });
    x.font = '700 40px ' + F;
    wrapLines(x, c.line2, W - 280).forEach(function (l) { x.fillText(l, 140, y); y += 56; });
    x.fillStyle = muted; x.font = '400 32px ' + F; y += 10;
    wrapLines(x, c.detail, W - 280).forEach(function (l) { x.fillText(l, 140, y); y += 46; });

    // Pied : émetteur, signature, code
    x.fillStyle = ink; x.font = '700 30px ' + F; x.fillText(c.issuer, 140, 1010);
    x.fillStyle = muted; x.font = '400 28px ' + F; x.fillText('Délivrée le ' + c.date + ' · ' + c.site, 140, 1052);
    x.textAlign = 'right';
    x.strokeStyle = ink; x.lineWidth = 2; x.beginPath(); x.moveTo(W - 620, 990); x.lineTo(W - 140, 990); x.stroke();
    x.fillStyle = ink; x.font = '700 30px ' + F; x.fillText(c.signName || '', W - 140, 1034);
    x.fillStyle = muted; x.font = '400 26px ' + F; x.fillText(c.signRole || '', W - 140, 1072);
    x.textAlign = 'center'; x.font = '400 24px ' + F; x.fillStyle = muted;
    x.fillText('Code de vérification : ' + c.code, W / 2, H - 96);
    return cv;
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
      Promise.all([document.fonts.load('700 40px "Atkinson Hyperlegible"'), document.fonts.load('400 40px "Atkinson Hyperlegible"')]),
      new Promise(function (r) { setTimeout(r, 1500); })
    ]).catch(function () {});
  }

  function canvasBlob(cv) { return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, 'image/png'); }); }

  var downloadsCap = null;
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(function (d) { downloadsCap = d; }).catch(function () {});
  }

  function saveBlob(filename, blob) {
    if (downloadsCap) return downloadsCap.save({ filename: filename, data: blob });
    return new Promise(function (res) {
      var url = URL.createObjectURL(blob), a = el('a', { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000); res({ status: 'saved' });
    });
  }

  function certPanel(opts) {
    // opts: {title, intro, getCert(name) -> cert object, onIssue(name, code), filename}
    var nameI = el('input', { type: 'text', maxlength: '60', autocomplete: 'name', value: opts.fixedName || store.get(NAME_KEY, '') || (SESSION.userName || '') });
    if (opts.fixedName) { nameI.readOnly = true; nameI.setAttribute('aria-describedby', ''); }
    var preview = el('img', { class: 'aca-cert-img', alt: 'Aperçu de l’attestation' });
    var msg = el('p', { class: 'aca-note', 'aria-live': 'polite' });
    var shareBtn = el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Partager', style: 'display:none', onclick: share });
    var current = null;

    function build() {
      var name = nameI.value.trim();
      if (!name) { preview.removeAttribute('src'); preview.style.display = 'none'; return Promise.resolve(null); }
      if (!opts.fixedName) store.set(NAME_KEY, name);
      return fontsReady().then(function () {
        var cv = drawCertificate(opts.getCert(name));
        preview.src = cv.toDataURL('image/png'); preview.style.display = '';
        current = cv; return cv;
      });
    }
    function ensure() {
      if (!nameI.value.trim()) { msg.textContent = 'Inscrivez votre nom et prénom pour obtenir l’attestation.'; nameI.focus(); return Promise.resolve(null); }
      opts.onIssue(nameI.value.trim());
      return build();
    }
    function download() {
      ensure().then(function (cv) {
        if (!cv) return;
        return canvasBlob(cv).then(function (b) { return saveBlob(opts.filename(), b); })
          .then(function () { msg.textContent = 'Attestation enregistrée. Vous pouvez l’envoyer par WhatsApp ou l’imprimer.'; })
          .catch(function (e) { msg.textContent = e && e.code === 'declined' ? 'Enregistrement annulé.' : 'L’enregistrement n’est pas possible ici. Faites un appui long sur l’image pour l’enregistrer.'; });
      });
    }
    function share() {
      ensure().then(function (cv) {
        if (!cv) return;
        return canvasBlob(cv).then(function (b) {
          var file = new File([b], opts.filename(), { type: 'image/png' });
          return navigator.share({ files: [file], title: 'Mon attestation AgroConnect Academy' });
        }).catch(function () {});
      });
    }
    try {
      if (!window.claude && navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] })) shareBtn.style.display = '';
    } catch (e) { /* partage indisponible */ }

    var t; nameI.addEventListener('input', function () { clearTimeout(t); t = setTimeout(build, 350); });
    build();
    return el('section', { class: 'aca-section aca-cert' }, [
      el('h3', { text: opts.title }),
      el('p', { text: opts.intro }),
      el('label', null, [opts.fixedName ? 'Nom du titulaire (celui de votre compte)' : 'Nom et prénom à inscrire', nameI]),
      opts.fixedName ? el('p', { class: 'aca-note', text: 'Pour corriger ce nom, contactez l’administrateur de la plateforme. Code vérifiable sur la page de vérification d’AgroConnect Academy.' }) : null,
      el('div', { class: 'aca-cert-frame' }, [preview]),
      el('div', { class: 'aca-cash-actions' }, [el('button', { type: 'button', class: 'aca-btn', text: 'Télécharger l’attestation', onclick: download }), shareBtn]),
      msg
    ]);
  }

  /* ---------- montage d'une formation ---------- */
  function mount(root, course) {
    var PKEY = 'aca_' + course.id + '_progress';
    var progress = store.get(PKEY, {});
    var current = 0;

    var bar = el('span');
    var progressText = el('p', { class: 'aca-progress-text' });
    var steps = el('nav', { class: 'aca-steps', 'aria-label': 'Modules de la formation' });
    var courseCertSlot = el('div');
    var courseCertShown = false;
    var stage = el('div');

    function doneCount() { return course.modules.filter(function (m) { return progress[m.id] && progress[m.id].pass; }).length; }
    function refreshProgress() {
      var d = doneCount(), t = course.totalModules || course.modules.length;
      bar.style.width = (d / t * 100) + '%';
      progressText.textContent = d === t
        ? (t === 1 ? 'Formation validée.' : 'Les ' + t + ' modules sont validés.') + (course.noFinalProject ? '' : ' Il reste à envoyer votre projet final à votre formateur.')
        : d + ' module' + (d > 1 ? 's' : '') + ' validé' + (d > 1 ? 's' : '') + ' sur ' + t;
      if (d === t && !courseCertShown) { courseCertShown = true; renderCourseCert(); }
      steps.textContent = '';
      course.modules.forEach(function (m, i) {
        var done = progress[m.id] && progress[m.id].pass;
        steps.appendChild(el('button', {
          type: 'button', class: 'aca-step' + (done ? ' is-done' : ''), 'aria-current': i === current ? 'true' : 'false',
          'aria-label': 'Module ' + m.number + ' : ' + m.title + (done ? ', validé' : ''),
          onclick: function () { show(i, true); }
        }, [el('span', { class: 'aca-step-n', text: done ? '✓' : String(m.number), 'aria-hidden': 'true' }), el('span', { text: m.label || m.title })]));
      });
      if (t > course.modules.length) {
        steps.appendChild(el('span', { class: 'aca-step is-soon', 'aria-label': 'Modules ' + (course.modules.length + 1) + ' à ' + t + ' bientôt disponibles' },
          [el('span', { class: 'aca-step-n', text: '…', 'aria-hidden': 'true' }), el('span', { text: 'Modules ' + (course.modules.length + 1) + ' à ' + t + ' bientôt' })]));
      }
    }

    function loginPanel(title, text) {
      return el('section', { class: 'aca-section aca-cert is-locked' }, [
        el('h3', { text: title }), el('p', { text: text }),
        CFG.loginUrl ? el('p', null, [el('a', { class: 'aca-btn', href: CFG.loginUrl, text: 'Me connecter' })]) : null
      ]);
    }
    function renderCourseCert() {
      var C = course.certificate || {};
      var KEY = 'course';
      courseCertSlot.textContent = '';
      if (SERVER && !SESSION.loggedIn) {
        courseCertSlot.appendChild(loginPanel('Votre certificat de parcours', 'Vous avez validé tous les modules sur ce téléphone. Pour obtenir un certificat vérifiable, connectez-vous puis validez les quiz avec votre compte.'));
        return;
      }
      if (SERVER && !(progress[KEY] && progress[KEY].cert)) {
        var wait = el('p', { class: 'aca-note', text: 'Préparation de votre certificat…' });
        courseCertSlot.appendChild(el('section', { class: 'aca-section aca-cert' }, [el('h3', { text: 'Votre certificat de parcours' }), wait]));
        api('course-certificate', { formation: course.id }).then(function (res) {
          progress[KEY] = { pass: true, best: 0, cert: res.cert }; store.set(PKEY, progress); renderCourseCert();
        }).catch(function (e) {
          wait.textContent = e && e.code === 'aca_not_completed' ? 'Certains modules ne sont pas encore validés avec votre compte.' : 'Le certificat n’a pas pu être préparé. Vérifiez votre connexion et rechargez la page.';
        });
        return;
      }
      var serverCert = SERVER ? progress[KEY].cert : null;
      if (SERVER && !courseCertSlot.getAttribute('data-ad')) {
        courseCertSlot.setAttribute('data-ad', '1');
        fetchAd('course_end', course.id, '').then(function (ad) { if (ad) courseCertSlot.appendChild(adCard(ad, null)); });
      }
      courseCertSlot.appendChild(certPanel({
        fixedName: serverCert ? serverCert.name : '',
        title: 'Votre certificat de parcours',
        intro: (course.modules.length === 1 ? 'Vous avez validé la formation. ' : 'Vous avez validé les ' + course.modules.length + ' modules. ') + (course.noFinalProject ? '' : (C.finalNote || '')),
        filename: function () { return 'certificat-' + course.id + '-' + slug(store.get(NAME_KEY, 'apprenant')) + '.png'; },
        onIssue: function (name) {
          if (SERVER) return;
          var r = progress[KEY] || (progress[KEY] = { pass: true, best: 0 });
          if (!r.cert) r.cert = { code: makeCode(course.id, 'parcours'), date: new Date().toISOString() };
          r.cert.name = name; store.set(PKEY, progress); remoteSave(course.id, progress);
        },
        getCert: function (name) {
          var r = progress[KEY], total = 0, best = 0;
          course.modules.forEach(function (m) { total += m.quiz.length; best += (progress[m.id] && progress[m.id].best) || 0; });
          return { kind: 'course', name: name,
            line1: course.modules.length === 1 ? 'pour avoir suivi et validé la formation' : 'pour avoir suivi et validé les ' + course.modules.length + ' modules de la formation',
            line2: '« ' + course.title + ' »',
            detail: 'Quiz : ' + best + ' bonnes réponses sur ' + total + '. ' + (course.noFinalProject ? '' : (C.courseDetail || '')),
            date: longDate(r && r.cert ? r.cert.date : null), code: r && r.cert ? r.cert.code : '— (cliquez sur Télécharger)',
            issuer: C.issuer || 'AgroConnect Academy', site: C.site || '', signName: C.signName || '', signRole: C.signRole || '' };
        }
      }));
    }

    var adShownBefore = false, adActive = false, adPending = false, contentShown = false;
    function showWithAd(i) {
      // Entre deux modules : seulement en passant au module suivant, jamais au milieu d'une leçon.
      fetchAd('between_modules', course.id, course.modules[i].id).then(function (ad) {
        if (!ad) { show(i, true); return; }
        stage.textContent = ''; adActive = true;
        stage.appendChild(adCard(ad, function () { adActive = false; show(i, true); }, 'Continuer vers le module ' + course.modules[i].number));
        if (root.scrollIntoView) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    function show(i, scroll) {
      current = i; contentShown = true;
      var m = course.modules[i];
      stage.textContent = '';
      var ex = m.example;
      var parts = [
        el('p', { class: 'aca-module-meta', text: 'Module ' + m.number + ' sur ' + (course.totalModules || course.modules.length) + ' · ' + m.duration }),
        el('h2', { text: m.title }),
        el('p', { class: 'aca-point', text: m.point }),
        el('section', { class: 'aca-section' }, [el('p', { class: 'aca-intro', text: m.intro })]),
        el('section', { class: 'aca-section' }, [
          el('h3', { text: 'À la fin de ce module, vous saurez' }),
          el('ol', { class: 'aca-objectives' }, m.objectives.map(function (o) { return el('li', { text: o }); }))
        ])
      ];
      m.lessons.forEach(function (l, li) {
        parts.push(el('section', { class: 'aca-section' }, [el('h3', { text: 'Leçon ' + m.number + '.' + (li + 1) + ' : ' + l.title })].concat(l.blocks.map(block))));
      });
      parts.push(el('section', { class: 'aca-section' }, [
        el('h3', { text: 'Exemple : ' + lcFirst(ex.title) }),
        el('p', { text: ex.text }),
        ex.head ? tableBlock(ex.head, ex.rows, numericColumns(ex.head)) : null,
        ex.after ? el('p', { text: ex.after }) : null
      ]));
      parts.push(videoSection(m.video));
      var td = m.toolDefaults || {};
      if (m.tool === 'benefice') parts.push(toolBenefice(td));
      if (m.tool === 'caisse') parts.push(toolCaisse(course.id, td));
      if (m.tool === 'cout') parts.push(toolCout(td));
      if (m.tool === 'prix') parts.push(toolPrix(td));
      if (m.tool === 'marge') parts.push(toolMarge(td));
      if (m.tool === 'budget') parts.push(toolBudget(course.id, td));
      if (m.tool === 'tresorerie') parts.push(toolTresorerie(course.id, td));
      if (m.tool === 'remboursement') parts.push(toolRemboursement(td));
      if (m.tool === 'prompt') parts.push(toolPrompt(td));
      if (m.tool === 'fiche') parts.push(toolFiche(td));
      if (m.tool === 'prospects') parts.push(toolProspects(course.id, td));
      if (m.tool === 'bon') parts.push(toolBon(td));
      if (m.tool === 'repartition') parts.push(toolRepartition(course.id, td));
      if (m.tool === 'pertes') parts.push(toolPertes(course.id, td));
      if (m.tool === 'transfo') parts.push(toolTransfo(td));
      if (m.tool === 'packaging') parts.push(toolPackaging(td));
      if (m.tool === 'canal') parts.push(toolCanal(td));
      if (m.tool === 'risques') parts.push(toolRisques(course.id, td));
      if (m.tool === 'capacite') parts.push(toolCapacite(td));
      if (m.tool === 'choix') parts.push(toolChoix(course.id, td));
      if (m.tool === 'cultures') parts.push(toolCultures(course.id, td));
      if (m.tool === 'scenarios') parts.push(toolScenarios(td));
      if (m.tool === 'pub') parts.push(toolPub(td));
      parts.push(activitySection(m.activity, course.id, m.id));
      parts.push(quizSection(m, course.passMark || 0.8, function (good, pass, extra) {
        var prev = progress[m.id] || {};
        progress[m.id] = { best: Math.max(prev.best || 0, good), pass: !!(prev.pass || pass), at: prev.pass ? prev.at : new Date().toISOString(), cert: (extra && extra.cert) || prev.cert };
        store.set(PKEY, progress); remoteSave(course.id, progress); refreshProgress(); renderCert();
        if (pass && certSlot.scrollIntoView) setTimeout(function () { certSlot.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 600);
      }, progress[m.id] && progress[m.id].pass ? progress[m.id].best : 0, course.id));
      var certSlot = el('div');
      parts.push(certSlot);
      function renderCert() {
        certSlot.textContent = '';
        var rec = progress[m.id];
        if (!rec || !rec.pass) {
          certSlot.appendChild(el('section', { class: 'aca-section aca-cert is-locked' }, [
            el('h3', { text: 'Votre attestation du module ' + m.number }),
            el('p', { text: 'Réussissez le quiz ci-dessus (au moins ' + Math.ceil((course.passMark || 0.8) * m.quiz.length) + ' bonnes réponses sur ' + m.quiz.length + ') pour débloquer votre attestation. Vous pourrez alors y inscrire votre nom et la télécharger.' })
          ]));
          return;
        }
        if (SERVER && !SESSION.loggedIn) {
          certSlot.appendChild(loginPanel('Votre attestation du module ' + m.number, 'Module validé sur ce téléphone. Pour obtenir une attestation vérifiable, connectez-vous puis refaites le quiz avec votre compte.'));
          return;
        }
        if (SERVER && !rec.cert) {
          certSlot.appendChild(el('section', { class: 'aca-section aca-cert is-locked' }, [el('h3', { text: 'Votre attestation du module ' + m.number }), el('p', { text: 'Refaites le quiz avec votre compte pour obtenir l’attestation vérifiable.' })]));
          return;
        }
        var C = course.certificate || {};
        certSlot.appendChild(certPanel({
          fixedName: SERVER ? rec.cert.name : '',
          title: 'Votre attestation du module ' + m.number,
          intro: 'Vous avez validé ce module. Téléchargez votre attestation et partagez-la.',
          filename: function () { return 'attestation-' + course.id + '-module-' + m.number + '-' + slug(store.get(NAME_KEY, 'apprenant')) + '.png'; },
          onIssue: function (name) {
            if (SERVER) return;
            var r = progress[m.id];
            if (!r.cert) { r.cert = { code: makeCode(course.id, m.id), date: new Date().toISOString() }; }
            r.cert.name = name;
            store.set(PKEY, progress); remoteSave(course.id, progress);
          },
          getCert: function (name) {
            var r = progress[m.id], code = r.cert ? r.cert.code : '— (cliquez sur Télécharger)';
            return { kind: 'module', name: name,
              line1: 'pour avoir validé le module ' + m.number + ' « ' + m.title + ' »',
              line2: 'de la formation « ' + course.title + ' »',
              detail: 'Score au quiz : ' + r.best + ' bonnes réponses sur ' + m.quiz.length + '.',
              date: longDate(r.cert ? r.cert.date : r.at), code: code,
              issuer: C.issuer || 'AgroConnect Academy', site: C.site || '', signName: C.signName || '', signRole: C.signRole || '' };
          }
        }));
      }
      renderCert();
      parts.push(el('section', { class: 'aca-section' }, [
        el('h3', { text: 'À retenir' }), el('p', { class: 'aca-summary', text: m.summary }),
        el('p', { class: 'aca-note', text: 'Ressource à télécharger : ' + m.resource })
      ]));
      var nav = el('div', { class: 'aca-nav' }, [
        i > 0 ? el('button', { type: 'button', class: 'aca-btn is-quiet', text: 'Module précédent', onclick: function () { show(i - 1, true); } }) : el('span'),
        i < course.modules.length - 1 ? el('button', { type: 'button', class: 'aca-btn', text: 'Module suivant', onclick: function () { SERVER ? showWithAd(i + 1) : show(i + 1, true); } }) : el('span')
      ]);
      parts.push(nav);
      stage.appendChild(el('article', { class: 'aca-module' }, parts));
      refreshProgress();
      if (scroll && root.scrollIntoView) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    root.textContent = '';
    root.appendChild(el('header', { class: 'aca-head' }, [
      el('p', { class: 'aca-kicker', text: 'AgroConnect Academy' }),
      el('h1', { class: 'aca-title', text: course.title }),
      el('p', { class: 'aca-lead', text: course.lead }),
      el('div', { class: 'aca-progress' }, [el('div', { class: 'aca-progress-bar', role: 'presentation' }, [bar]), progressText])
    ]));
    root.appendChild(courseCertSlot);
    root.appendChild(steps);
    root.appendChild(stage);
    root.appendChild(el('p', { class: 'aca-fineprint', text: course.note }));

    var seenKey = 'aca_adbefore_' + course.id, seen = null;
    try { seen = window.sessionStorage.getItem(seenKey); } catch (e) { seen = null; }
    if (SERVER && !seen && !adShownBefore) {
      // Avant la formation : la publicité est demandée AVANT d'afficher le contenu (1,5 s au plus), puis la formation commence.
      adShownBefore = true; adPending = true;
      stage.appendChild(el('p', { class: 'aca-note', text: 'Chargement de la formation…' }));
      fetchAd('before_course', course.id, '').then(function (ad) {
        adPending = false;
        if (contentShown) return; // un contenu déjà affiché n'est jamais remplacé par une publicité
        if (!ad) { show(0, false); return; }
        try { window.sessionStorage.setItem(seenKey, '1'); } catch (e) { /* ignorer */ }
        stage.textContent = ''; adActive = true;
        stage.appendChild(adCard(ad, function () { adActive = false; show(0, false); }, 'Commencer la formation'));
      });
    } else {
      show(0, false);
    }

    remoteLoad(course.id).then(function (remote) {
      if (!remote || !remote.progress) return;
      if (SERVER) {
        // Compte connecté : seule la progression validée par le serveur fait foi.
        progress = remote.progress; store.set(PKEY, progress); courseCertShown = false;
        if (adActive || adPending) refreshProgress(); else show(current, false); // ne jamais remplacer une publicité affichée ou attendue
        return;
      }
      Object.keys(remote.progress).forEach(function (k) {
        var r = remote.progress[k], l = progress[k];
        if (!l || (r.best || 0) > (l.best || 0) || (r.pass && !l.pass)) progress[k] = r;
      });
      store.set(PKEY, progress); refreshProgress();
    });
  }

  /* ---------- publicité (AgroConnect Academy Ads) ---------- */
  // Trois emplacements seulement, jamais pendant une leçon. Les événements sont validés par le serveur.
  function deviceId() {
    var k = 'aca_device', v = store.get(k, '');
    if (!/^[a-f0-9]{32}$/.test(v || '')) {
      var b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b);
      v = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); store.set(k, v);
    }
    return v;
  }
  function fetchAd(placement, formation, module) {
    if (!SERVER) return Promise.resolve(null);
    var q = 'ad?placement=' + placement + '&formation=' + encodeURIComponent(formation || '') + '&module=' + encodeURIComponent(module || '') + '&device=' + deviceId();
    var timeout = new Promise(function (res) { setTimeout(function () { res(null); }, 1500); });
    return Promise.race([api(q).then(function (r) { return r && r.ad ? r.ad : null; }).catch(function () { return null; }), timeout]);
  }
  function adEvent(token, event) { api('ad-event', { token: token, event: event }).catch(function () {}); }
  function adCard(ad, onDone, continueLabel) {
    var started = false, finished = false, timer = null, closed = false;
    var skipBtn = onDone ? el('button', { type: 'button', class: 'aca-btn is-quiet', disabled: ad.skipAfterSec > 0 ? true : null, onclick: close }) : null;
    var media = null;
    function start() { if (started) return; started = true; adEvent(ad.token, 'start'); }
    function complete() { if (finished) return; finished = true; adEvent(ad.token, 'complete'); if (media && media.pause) media.pause(); }
    if (ad.mediaUrl && ad.mediaType === 'video') {
      media = el('video', { class: 'aca-ad-media', src: ad.mediaUrl, controls: true, playsinline: true, preload: 'none' });
      if (ad.autoplay) { media.muted = true; media.autoplay = true; }
      media.addEventListener('play', start);
      media.addEventListener('timeupdate', function () { if (media.currentTime >= ad.durationSec) complete(); });
      media.addEventListener('ended', complete);
    } else if (ad.mediaUrl) {
      media = el('img', { class: 'aca-ad-media', src: ad.mediaUrl, alt: ad.headline || ('Publicité ' + (ad.advertiser || '')), loading: 'lazy' });
    }
    function close() { if (closed) return; closed = true; clearInterval(timer); if (media && media.pause) media.pause(); if (onDone) onDone(); }
    var left = ad.skipAfterSec;
    function tick() {
      if (!skipBtn) return;
      if (left > 0) { skipBtn.textContent = (continueLabel || 'Continuer') + ' dans ' + left + ' s'; left--; }
      else { skipBtn.disabled = false; skipBtn.textContent = continueLabel || 'Continuer'; }
    }
    var card = el('aside', { class: 'aca-ad', 'aria-label': 'Contenu sponsorisé' }, [
      el('p', { class: 'aca-ad-label' }, [el('span', { class: 'aca-ad-tag', text: ad.label || 'Sponsorisé' }), ad.advertiser ? el('span', { text: ' · ' + ad.advertiser }) : null]),
      ad.logoUrl ? el('img', { class: 'aca-ad-logo', src: ad.logoUrl, alt: ad.advertiser || '', loading: 'lazy' }) : null,
      media,
      ad.headline ? el('p', { class: 'aca-ad-title', text: ad.headline }) : null,
      ad.body ? el('p', { text: ad.body }) : null,
      el('div', { class: 'aca-cash-actions' }, [
        ad.clickUrl ? el('a', { class: 'aca-btn', href: ad.clickUrl, target: '_blank', rel: 'sponsored noopener', text: 'En savoir plus' }) : null,
        skipBtn
      ])
    ]);
    // Impression : quand le spot est réellement visible à l'écran pendant au moins une seconde.
    var shown = false;
    function markShown() {
      if (shown) return; shown = true; adEvent(ad.token, 'impression');
      if (!media || ad.mediaType !== 'video') {
        setTimeout(start, 50);
        setTimeout(function () { if (!closed) complete(); }, ad.durationSec * 1000 + 500);
      }
    }
    if (window.IntersectionObserver) {
      var t0 = null, io = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) { t0 = setTimeout(function () { markShown(); io.disconnect(); }, 1000); }
          else if (t0) { clearTimeout(t0); t0 = null; }
        });
      }, { threshold: [0, 0.5, 1] });
      setTimeout(function () { io.observe(card); }, 0);
    } else { setTimeout(markShown, 1000); }
    if (skipBtn) { tick(); timer = setInterval(tick, 1000); }
    return card;
  }

  /* ---------- formations payantes : achat et retour de paiement ---------- */
  function fmtXaf(n) { return fmt.format(n) + ' FCFA'; }
  function paywall(root, fid, d) {
    d = d || {};
    root.textContent = '';
    var msg = el('p', { class: 'aca-note', 'aria-live': 'polite' });
    var parts = [
      el('p', { class: 'aca-kicker', text: 'AgroConnect Academy' }),
      el('h1', { class: 'aca-title', text: d.title || 'Formation' }),
      d.lead ? el('p', { class: 'aca-lead', text: d.lead }) : null,
      el('section', { class: 'aca-section aca-cert' }, [
        el('h3', { text: 'Formation payante' + (d.price ? ' : ' + fmtXaf(d.price) : '') }),
        el('p', { text: (d.modules ? d.modules + ' modules, quiz et attestations vérifiables. ' : '') + 'L’accès s’ouvre dès que votre paiement est confirmé par le serveur.' })
      ])
    ];
    var box = parts[parts.length - 1];
    if (!SESSION.loggedIn) {
      box.appendChild(el('p', null, [el('a', { class: 'aca-btn', href: CFG.loginUrl || '#', text: 'Me connecter pour acheter' })]));
    } else if (!d.payable) {
      box.appendChild(el('p', { text: 'Le paiement en ligne n’est pas encore disponible. Contactez AgroConnect Academy pour vous inscrire.' }));
    } else {
      var btn = el('button', { type: 'button', class: 'aca-btn', text: 'Payer ' + fmtXaf(d.price) + ' par Mobile Money (MTN ou Orange Money)', onclick: function () {
        btn.disabled = true; msg.textContent = 'Préparation du paiement…';
        api('checkout', { formation: fid }).then(function (res) {
          msg.textContent = 'Redirection vers la page de paiement sécurisée…';
          window.location.href = res.paymentUrl;
        }).catch(function (e) {
          btn.disabled = false;
          msg.textContent = e && e.message ? e.message : 'Le paiement n’a pas pu démarrer. Vérifiez votre connexion et réessayez.';
        });
      }});
      box.appendChild(el('div', { class: 'aca-cash-actions' }, [btn]));
      box.appendChild(el('p', { class: 'aca-note', text: 'Vous serez dirigé vers la page sécurisée de notre prestataire de paiement, puis ramené ici. Votre numéro et votre code Mobile Money ne sont jamais saisis sur ce site.' }));
    }
    box.appendChild(msg);
    parts.forEach(function (p) { if (p) root.appendChild(p); });
  }
  function orderReturn(root, fid, ref, done) {
    root.textContent = '';
    var status = el('p', { class: 'aca-note', 'aria-live': 'polite', text: 'Vérification de votre paiement auprès du prestataire…' });
    var box = el('section', { class: 'aca-section aca-cert' }, [el('h3', { text: 'Paiement en cours de vérification' }), status]);
    root.appendChild(box);
    var tries = 0;
    function clean() { try { var u = new URL(window.location.href); u.searchParams.delete('aca_order'); window.history.replaceState(null, '', u.toString()); } catch (e) { /* ignorer */ } }
    function poll() {
      tries++;
      api('order/' + encodeURIComponent(ref)).then(function (res) {
        var o = res.order || {};
        if (o.status === 'paid' && res.access) { clean(); done(o); return; }
        if (o.status === 'failed' || o.status === 'expired') {
          clean(); status.textContent = 'Le paiement n’a pas abouti. Si un montant a malgré tout été débité, contactez AgroConnect Academy avec la référence ' + ref + '. Vous pouvez réessayer.';
          box.appendChild(el('p', null, [el('button', { type: 'button', class: 'aca-btn', text: 'Revenir à la formation', onclick: function () { window.location.reload(); } })]));
          return;
        }
        if (o.status === 'review') { clean(); status.textContent = 'Votre paiement a été reçu mais doit être contrôlé par notre équipe. Vous serez informé, référence ' + ref + '.'; return; }
        if (tries < 36) { status.textContent = 'Paiement en attente de confirmation… Si votre téléphone vous le demande, validez le paiement avec votre code Mobile Money.'; setTimeout(poll, 5000); return; }
        status.textContent = 'Le paiement n’est pas encore confirmé. Dès qu’il le sera, votre accès s’ouvrira automatiquement : rechargez cette page dans quelques minutes. Référence : ' + ref + '.';
      }).catch(function () {
        if (tries < 36) { setTimeout(poll, 5000); return; }
        status.textContent = 'La vérification n’a pas pu se faire. Rechargez la page plus tard. Référence : ' + ref + '.';
      });
    }
    poll();
  }

  /**
   * Démarre le lecteur sur un élément. opts : { formation, course, src } (sinon lus dans les attributs data-).
   */
  function start(root, opts) {
    opts = opts || {};
    var run = root._acaRun = (root._acaRun || 0) + 1;
    function current() { return root._acaRun === run; } // un montage plus récent ou un destroy annule celui-ci
    {
      var inlineId = root.getAttribute('data-json'), fid = opts.formation || root.getAttribute('data-formation');
      var inline = opts.course ? 'given' : inlineId;
      var src = opts.src || root.getAttribute('data-src');
      var orderRef = null;
      try { orderRef = SERVER ? new URL(window.location.href).searchParams.get('aca_order') : null; } catch (e) { orderRef = null; }
      if (orderRef && fid && !/^[A-Z0-9]{6,40}$/.test(orderRef)) orderRef = null;
      if (orderRef && fid) {
        getSession().then(function () {
          if (!current()) return;
          orderReturn(root, fid, orderRef, function () {
            api('course/' + encodeURIComponent(fid)).then(function (course) { if (current()) mount(root, course); }).catch(function () { window.location.reload(); });
          });
        });
        return;
      }
      var load = inline
        ? Promise.resolve(opts.course ? JSON.parse(JSON.stringify(opts.course)) : JSON.parse(document.getElementById(inline).textContent))
        : (SERVER && fid && !src)
          ? getSession().then(function () { return api('course/' + encodeURIComponent(fid)); })
          : fetch(src, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
      load.then(function (course) { if (current()) mount(root, course); }).catch(function (e) {
        if (!current()) return;
        if (e && e.code === 'aca_locked' && SERVER && fid) { paywall(root, fid, e.data); return; }
        root.textContent = '';
        root.appendChild(el('p', { class: 'aca-error', text: e && e.code === 'aca_locked' ? 'Cette formation est réservée aux apprenants inscrits.' : 'La formation n’a pas pu se charger. Vérifiez votre connexion, puis rechargez la page.' }));
      });
    }
  }

  function boot() {
    var roots = document.querySelectorAll('.aca[data-src], .aca[data-json], .aca[data-formation]');
    Array.prototype.forEach.call(roots, function (root) {
      if (root.getAttribute('data-aca-mounted')) return;
      root.setAttribute('data-aca-mounted', '1');
      start(root);
    });
  }

  /* ---------- interface publique ---------- */
  window.AgroConnectAcademy = {
    version: '0.6.0',
    configure: applyConfig,
    /**
     * Monte le lecteur dans un élément et renvoie { destroy }.
     * options : { formation: 'f14' } (mode serveur) ou { course: objetJSON } (mode autonome), et config : {
     *   server, restUrl, sessionUrl, loginUrl, headers (objet ou fonction, par ex. Authorization), credentials, loggedIn, userName }.
     */
    mount: function (element, options) {
      options = options || {};
      if (!element) throw new Error('AgroConnectAcademy.mount : élément manquant');
      applyConfig(options.config);
      element.classList.add('aca');
      element.setAttribute('data-aca-mounted', '1');
      element.textContent = '';
      element.appendChild(el('p', { text: 'Chargement de la formation…' }));
      var alive = true;
      start(element, options);
      return {
        destroy: function () {
          if (!alive) return; alive = false;
          element._acaRun = (element._acaRun || 0) + 1;
          // Arrête les vidéos éventuelles et vide l'élément ; les minuteries restantes ne touchent plus qu'un nœud détaché.
          Array.prototype.forEach.call(element.querySelectorAll('video'), function (v) { try { v.pause(); } catch (e) { /* ignorer */ } });
          element.textContent = '';
          element.removeAttribute('data-aca-mounted');
        }
      };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
