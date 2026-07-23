/**
 * Vista previa = el sitio público real cargado en un <iframe> (mismo HTML,
 * mismo CSS, mismo JS que ve cualquier visitante — no una maqueta aparte que
 * hay que mantener sincronizada a mano). Al cargar y en cada cambio, este
 * módulo reescribe dentro del iframe exactamente los nodos que dependen del
 * contenido editable, usando las mismas clases/estructura que ya genera
 * public/index.php — así el resultado es indistinguible del sitio real.
 *
 * Los bloques que se repiten (proyectos, habilidades, experiencia,
 * certificaciones, idiomas) se reconstruyen enteros en cada cambio porque su
 * cantidad puede variar; los bloques únicos (hero, contacto, educación) solo
 * actualizan el texto de sus nodos existentes.
 *
 * Limitación conocida: el iframe es el sitio real e interactivo (se puede
 * hacer scroll, abrir el CV, seguir los enlaces del menú) — solo se
 * neutralizan los botones de tema/idioma DEL SITIO (no los de Apariencia del
 * dashboard) para que un clic accidental ahí dentro no reescriba la
 * preferencia guardada de tu propio navegador para el sitio real.
 */
(function () {
  // Definidas una sola vez en admin-escape.js (window.MPVEscape), cargado
  // antes que este archivo — ver ese archivo para el porqué.
  var escapeHtml = window.MPVEscape.html;
  var escapeAttr = window.MPVEscape.attr;

  // Fallback bidireccional (igual que t() en src/helpers.php): si el idioma
  // activo no tiene texto, se usa el del otro en vez de dejarlo vacío — antes
  // solo caía ES→EN, nunca al revés (Ficha rápida/Habilidades creadas
  // primero en inglés se veían vacías al cambiar a español).
  function fallbackEn(es, en) {
    return (en && String(en).trim() !== '') ? en : (es || '');
  }
  function fallbackEs(es, en) {
    return (es && String(es).trim() !== '') ? es : (en || '');
  }
  function pick(es, en, lang) {
    return lang === 'en' ? fallbackEn(es, en) : fallbackEs(es, en);
  }
  function dynAttrs(es, en) {
    return ' data-i18n-dynamic data-es="' + escapeAttr(fallbackEs(es, en)) + '" data-en="' + escapeAttr(fallbackEn(es, en)) + '"';
  }
  function safeUrl(url) {
    url = (url || '').trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }
  // Igual que safeUrl() pero también acepta mailto: (chip "Email" de redes
  // sociales, ver admin-social-links.js) — se mantiene aparte porque
  // safeUrl() sigue usándose tal cual para demo/code de proyectos.
  function safeSocialUrl(url) {
    url = (url || '').trim();
    if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(url)) return url;
    return safeUrl(url);
  }
  // Igual que contact_link_href() en src/helpers.php — para la lista libre
  // de medios de contacto (ver punto 11).
  function contactLinkHref(value) {
    value = (value || '').trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'mailto:' + value;
    if (/^[+()0-9][0-9()\s.\-]{5,}$/.test(value)) return 'tel:' + value.replace(/[^0-9+]/g, '');
    return null;
  }
  function projectDomain(title) {
    var slug = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'proyecto';
  }
  // Mismos dos helpers que dot_color_style()/skill_level_pill_style() en
  // src/helpers.php — ver ese archivo para la explicación completa (hex+alpha
  // replicando el halo/borde suave que antes solo existía como CSS fijo).
  function dotColorStyle(hex) {
    return hex ? ('background:' + hex + '; box-shadow:0 0 0 4px ' + hex + '38;') : '';
  }
  // Igual que badge_color_style() en src/helpers.php: el fondo/borde de toda
  // la insignia de disponibilidad de Contacto, no solo el punto — antes se
  // quedaban fijos en verde sin importar qué color se eligiera para el LED.
  function badgeColorStyle(hex) {
    return hex ? ('background:' + hex + '1F; border-color:' + hex + '59;') : '';
  }
  function skillLevelPillStyle(hex) {
    return hex ? (' style="color:' + hex + '; border-color:' + hex + '59;"') : '';
  }
  // Misma regla que skill_level_pill_class() en src/helpers.php — se evalúa
  // siempre sobre el texto en español, igual que hace el sitio real (así el
  // color del nivel no cambia al alternar el idioma de vista previa).
  function skillLevelPillClass(levelEs) {
    var l = (levelEs || '').toLowerCase();
    if (l.indexOf('avanzado') !== -1) return 'level-pill--green';
    if (l.indexOf('intermedio') !== -1) return 'level-pill--accent';
    if (l.indexOf('básico') !== -1 || l.indexOf('basico') !== -1) return 'level-pill--amber';
    if (l.indexOf('herramienta') !== -1) return 'level-pill--purple';
    if (l.indexOf('sistema') !== -1) return 'level-pill--teal';
    return 'level-pill--neutral';
  }
  // Empareja dos listas ES/EN por índice hasta la más larga de las dos —
  // mismo criterio que t_list() en src/helpers.php (fallback bidireccional):
  // antes se iteraba solo sobre la lista en español, así que una lista
  // creada primero en inglés (con la española todavía vacía) no mostraba
  // nada en la vista previa aunque sí hubiera contenido en inglés.
  function zipLines(esArr, enArr) {
    var len = Math.max(esArr.length, enArr.length);
    var out = [];
    for (var i = 0; i < len; i++) {
      out.push({ es: esArr[i] || '', en: enArr[i] || '' });
    }
    return out;
  }

  function splitEmDash(line) {
    var parts = (line || '').split('—');
    return [(parts[0] || '').trim(), (parts[1] || '').trim()];
  }

  /* ---------- plantillas (mismas clases que public/index.php) ---------- */

  // Botones del CTA de un proyecto — cantidad libre (punto 13), primary→
  // btn-accent / secondary→btn-outline, mismas clases que ya existían para
  // Demo/Código (ahora desacopladas de esos 2 roles fijos).
  function projectButtonsHtml(buttons, lang) {
    return (buttons || []).map(function (btn) {
      var url = safeUrl(btn.url);
      if (!url) return '';
      var cls = btn.style === 'primary' ? 'btn-accent' : 'btn-outline';
      return '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener" class="btn ' + cls + '"' + dynAttrs(btn.label, btn.labelEn) + '>' + escapeHtml(pick(btn.label, btn.labelEn, lang)) + '</a>';
    }).join('');
  }

  function flagshipHtml(p, index, i18n, lang, stackList) {
    var imageHtml = p.image
      ? '<img class="flagship__image" src="uploads/projects/' + escapeAttr(p.image) + '" alt="' + escapeAttr(p.title) + '">'
      : '<div class="flagship__image image-drop"><div class="image-drop__placeholder">' + escapeHtml(i18n['hero.imagePlaceholder']) + '</div></div>';
    var chips = stackList.map(function (t) { return '<span class="chip">' + escapeHtml(t) + '</span>'; }).join('');
    var stats = [1, 2, 3].map(function (n) {
      var v = p['stat' + n + 'Value'];
      if (!v) return '';
      var l = p['stat' + n + 'Label'], lEn = p['stat' + n + 'LabelEn'];
      return '<div><p class="flagship__stat-value">' + escapeHtml(v) + '</p><p class="flagship__stat-label"' + dynAttrs(l, lEn) + '>' + escapeHtml(pick(l, lEn, lang)) + '</p></div>';
    }).join('');
    var ctaHtml = projectButtonsHtml(p.buttons, lang);
    return '' +
      '<article class="flagship" data-reveal data-preview-target="projects" data-preview-index="' + index + '">' +
        '<div class="flagship__bar"><span class="flagship__bar-label">' + escapeHtml(i18n['fp.kick']) + '</span></div>' +
        '<div class="flagship__body">' +
          imageHtml +
          '<div class="flagship__content">' +
            '<div>' +
              '<h3 class="flagship__title">' + escapeHtml(p.title) + '</h3>' +
              '<p class="flagship__subtitle"' + dynAttrs(p.what, p.whatEn) + '>' + escapeHtml(pick(p.what, p.whatEn, lang)) + '</p>' +
              (chips ? '<div class="flagship__stack">' + chips + '</div>' : '') +
            '</div>' +
            '<div class="flagship__narrative">' +
              '<div><p class="flagship__narrative-label">' + escapeHtml(i18n['fp.problem.l']) + '</p><p class="flagship__narrative-text"' + dynAttrs(p.problem, p.problemEn) + '>' + escapeHtml(pick(p.problem, p.problemEn, lang)) + '</p></div>' +
              '<div><p class="flagship__narrative-label">' + escapeHtml(i18n['fp.decision.l']) + '</p><p class="flagship__narrative-text"' + dynAttrs(p.decision, p.decisionEn) + '>' + escapeHtml(pick(p.decision, p.decisionEn, lang)) + '</p></div>' +
              '<div><p class="flagship__narrative-label">' + escapeHtml(i18n['fp.result.l']) + '</p><p class="flagship__narrative-text"' + dynAttrs(p.result, p.resultEn) + '>' + escapeHtml(pick(p.result, p.resultEn, lang)) + '</p></div>' +
            '</div>' +
            (stats ? '<div class="flagship__stats">' + stats + '</div>' : '') +
            '<div class="flagship__cta">' + ctaHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function projectCardHtml(p, index, i18n, lang, stackList) {
    var imageHtml = p.image
      ? '<img class="project-card__image" src="uploads/projects/' + escapeAttr(p.image) + '" alt="' + escapeAttr(p.title) + '">'
      : '<div class="project-card__image image-drop"><div class="image-drop__placeholder">' + escapeHtml(i18n['hero.imagePlaceholder']) + '</div></div>';
    var chips = stackList.map(function (t) { return '<span class="chip">' + escapeHtml(t) + '</span>'; }).join('');
    var ctaHtml = projectButtonsHtml(p.buttons, lang);
    return '' +
      '<article class="project-card" data-reveal data-preview-target="projects" data-preview-index="' + index + '">' +
        '<div class="project-card__browser">' +
          '<div class="project-card__bar"><span class="traffic-lights"><span></span><span></span><span></span></span><span class="project-card__domain">' + escapeHtml(projectDomain(p.title)) + '</span></div>' +
          imageHtml +
        '</div>' +
        '<div class="project-card__body">' +
          '<div class="project-card__head"><h3 class="project-card__title">' + escapeHtml(p.title) + '</h3><span class="project-card__tag">' + escapeHtml(p.tag) + '</span></div>' +
          '<p class="project-card__text"><strong>' + escapeHtml(i18n['proj.what.l']) + '</strong> <span' + dynAttrs(p.what, p.whatEn) + '>' + escapeHtml(pick(p.what, p.whatEn, lang)) + '</span></p>' +
          '<p class="project-card__text"><strong>' + escapeHtml(i18n['proj.mine.l']) + '</strong> <span' + dynAttrs(p.mine, p.mineEn) + '>' + escapeHtml(pick(p.mine, p.mineEn, lang)) + '</span></p>' +
          '<p class="project-card__impact"><span class="project-card__impact-label">' + escapeHtml(i18n['imp.label']) + '</span><span' + dynAttrs(p.impact, p.impactEn) + '>' + escapeHtml(pick(p.impact, p.impactEn, lang)) + '</span></p>' +
          '<div class="project-card__stack">' + chips + '</div>' +
          '<div class="project-card__cta">' + ctaHtml + '</div>' +
        '</div>' +
      '</article>';
  }

  function skillsGridHtml(skills, lang) {
    return skills.map(function (cat, ci) {
      var rows = cat.items.map(function (s) {
        return '<div class="skill-row"><span class="skill-row__name">' + escapeHtml(s.name) + '</span><span class="level-pill ' + skillLevelPillClass(s.level) + '"' + skillLevelPillStyle(s.levelColor) + dynAttrs(s.level, s.levelEn) + '>' + escapeHtml(pick(s.level, s.levelEn, lang)) + '</span></div>';
      }).join('');
      return '<div class="skill-card" data-reveal data-preview-target="skills" data-preview-index="' + ci + '"><p class="skill-card__title"' + dynAttrs(cat.name, cat.nameEn) + '>' + escapeHtml(pick(cat.name, cat.nameEn, lang)) + '</p><div class="skill-card__list">' + rows + '</div></div>';
    }).join('');
  }

  function experienceHtml(experience, lang, utils) {
    return experience.map(function (x, i) {
      var bullets = zipLines(utils.splitLines(x.bulletsStr), utils.splitLines(x.bulletsEnStr)).map(function (line) {
        return '<li' + dynAttrs(line.es, line.en) + '>' + escapeHtml(pick(line.es, line.en, lang)) + '</li>';
      }).join('');
      var metrics = zipLines(utils.splitCsv(x.metricsStr), utils.splitCsv(x.metricsEnStr)).map(function (line) {
        return '<span class="metric-pill"' + dynAttrs(line.es, line.en) + '>' + escapeHtml(pick(line.es, line.en, lang)) + '</span>';
      }).join('');
      var dateText = window.MPVDatepicker.formatDateRange(x.startDate, x.isCurrent ? null : x.endDate, lang);
      var durationText = window.MPVDatepicker.formatDuration(x.startDate, x.isCurrent ? null : x.endDate, lang);
      // MISMA estructura que el bloque de Experiencia en public/index.php —
      // .timeline-item es un grid de exactamente 2 columnas (200px 1fr), así
      // que fecha+duración van SIEMPRE agrupadas en un solo div (la primera
      // columna); agregarlas como hijos sueltos rompe el grid entero (le
      // toca a este <div> ajeno la 2da columna y el contenido real —rol,
      // organización, viñetas— se cae a una 3ra fila de solo 200px). Si se
      // toca esta plantilla, hay que tocar la de allá también — y viceversa.
      return '' +
        '<div class="timeline-item" data-reveal data-preview-target="experience" data-preview-index="' + i + '">' +
          '<div class="timeline-item__dates">' +
            '<p class="timeline-item__date">' + escapeHtml(dateText) + '</p>' +
            (durationText ? '<p class="timeline-item__duration">' + escapeHtml(durationText) + '</p>' : '') +
          '</div>' +
          '<div>' +
            '<h3 class="timeline-item__role"' + dynAttrs(x.role, x.roleEn) + '>' + escapeHtml(pick(x.role, x.roleEn, lang)) + '</h3>' +
            '<p class="timeline-item__org"' + dynAttrs(x.org, x.orgEn) + '>' + escapeHtml(pick(x.org, x.orgEn, lang)) + '</p>' +
            '<ul class="timeline-item__bullets">' + bullets + '</ul>' +
            '<div class="timeline-item__metrics">' + metrics + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function certsHtml(certs, lang) {
    return certs.map(function (c, i) {
      // "Institución · fecha completa" se compone aquí igual que en
      // public/index.php — issuer/issuerEn ya no traen la fecha escrita a
      // mano (punto 6).
      var dateEs = window.MPVDatepicker.formatEsDateLong(c.issueDate, 'es');
      var dateEn = window.MPVDatepicker.formatEsDateLong(c.issueDate, 'en');
      var issuerFullEs = dateEs ? ((c.issuer || '') + ' · ' + dateEs) : (c.issuer || '');
      var issuerFullEn = dateEn ? ((c.issuerEn || c.issuer || '') + ' · ' + dateEn) : (c.issuerEn || '');
      return '' +
        '<div class="cert-row" data-preview-target="certifications" data-preview-index="' + i + '">' +
          '<span class="cert-row__name"' + dynAttrs(c.name, c.nameEn) + '>' + escapeHtml(pick(c.name, c.nameEn, lang)) + '</span>' +
          '<span class="cert-row__issuer"' + dynAttrs(issuerFullEs, issuerFullEn) + '>' + escapeHtml(pick(issuerFullEs, issuerFullEn, lang)) + '</span>' +
        '</div>';
    }).join('');
  }

  function langListHtml(edu, lang, utils, labelText) {
    var items = zipLines(utils.splitLines(edu.languagesStr), utils.splitLines(edu.languagesEnStr)).map(function (line) {
      var esParts = splitEmDash(line.es || line.en);
      var enParts = splitEmDash(line.en || line.es);
      var nameVisible = pick(esParts[0], enParts[0], lang);
      var descEs = '— ' + (esParts[1] || '');
      var descEn = '— ' + (enParts[1] || esParts[1] || '');
      var descVisible = lang === 'en' ? descEn : descEs;
      return '<p class="lang-list__item"><strong' + dynAttrs(esParts[0], enParts[0]) + '>' + escapeHtml(nameVisible) + '</strong> <span data-i18n-dynamic data-es="' + escapeAttr(descEs) + '" data-en="' + escapeAttr(descEn) + '">' + escapeHtml(descVisible) + '</span></p>';
    }).join('');
    return '<p class="lang-list__label">' + escapeHtml(labelText) + '</p>' + items;
  }

  /* ---------- sincronización de bloques únicos (hero, contacto, educación) ---------- */

  function heroFactsHtml(facts, lang) {
    return facts.map(function (f) {
      return '' +
        '<div class="hero__fact">' +
          '<p class="hero__fact-label"' + dynAttrs(f.label, f.labelEn) + '>' + escapeHtml(pick(f.label, f.labelEn, lang)) + '</p>' +
          '<p class="hero__fact-value"' + dynAttrs(f.value, f.valueEn) + '>' + escapeHtml(pick(f.value, f.valueEn, lang)) + '</p>' +
        '</div>';
    }).join('');
  }

  function syncHero(doc, state, lang) {
    var h = state.hero;
    var setDyn = function (selector, es, en) {
      var el = doc.querySelector(selector);
      if (!el) return;
      el.setAttribute('data-es', fallbackEs(es, en));
      el.setAttribute('data-en', fallbackEn(es, en));
      el.textContent = pick(es, en, lang);
    };
    var title = doc.querySelector('.hero__title');
    if (title) title.textContent = h.name || '';
    var badgeDot = doc.querySelector('.hero__badge-dot');
    if (badgeDot) badgeDot.setAttribute('style', dotColorStyle(h.availColor));
    setDyn('.hero__badge span[data-i18n-dynamic]', h.avail, h.availEn);
    setDyn('.hero__role', h.role, h.roleEn);
    setDyn('.hero__desc', h.desc, h.descEn);

    var factsContainer = doc.querySelector('.hero__facts');
    if (factsContainer) factsContainer.innerHTML = heroFactsHtml(state.heroFacts, lang);

    // Mismo par ES/EN (con fallback fallbackEn()) que manda public/index.php
    // — typewriter.js elige cuál mostrar según el idioma activo. Antes esto
    // solo mandaba UN idioma (el de la vista previa en ese momento) y nunca
    // se le avisaba a typewriter.js que había cambiado algo, así que el
    // bloque "perfil.js" de la vista previa se quedaba con lo que se
    // escribió cuando el iframe cargó por primera vez, sin importar qué se
    // editara después. window.MPVTypewriter.render() (expuesto por el
    // propio typewriter.js del iframe) lo vuelve a dibujar ahora mismo.
    var typewriter = doc.querySelector('.hero__code-pre[data-typewriter]');
    if (typewriter) {
      typewriter.setAttribute('data-role-es', fallbackEs(h.role, h.roleEn));
      typewriter.setAttribute('data-role-en', fallbackEn(h.role, h.roleEn));
      typewriter.setAttribute('data-availability-es', fallbackEs(h.avail, h.availEn));
      typewriter.setAttribute('data-availability-en', fallbackEn(h.avail, h.availEn));
      typewriter.setAttribute('data-facts-es', JSON.stringify(state.heroFacts.map(function (f) {
        return { label: fallbackEs(f.label, f.labelEn), value: fallbackEs(f.value, f.valueEn) };
      })));
      typewriter.setAttribute('data-facts-en', JSON.stringify(state.heroFacts.map(function (f) {
        return { label: fallbackEn(f.label, f.labelEn), value: fallbackEn(f.value, f.valueEn) };
      })));
      var win = doc.defaultView;
      if (win && win.MPVTypewriter) win.MPVTypewriter.render(lang);
    }

    var footerName = doc.querySelector('.site-footer__name');
    if (footerName) footerName.textContent = h.name || '';
  }

  // Mismo mapa dominio→ícono/etiqueta que detect_social_platform() en
  // src/helpers.php y admin-social-links.js — ver la nota en ese archivo
  // sobre por qué se repite en vez de compartirse.
  var SOCIAL_DOMAIN_MAP = {
    'linkedin.com': 'LinkedIn', 'github.com': 'GitHub',
    'twitter.com': 'X (Twitter)', 'x.com': 'X (Twitter)',
    'instagram.com': 'Instagram', 'facebook.com': 'Facebook', 'fb.com': 'Facebook',
    'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
    'wa.me': 'WhatsApp', 'whatsapp.com': 'WhatsApp',
    't.me': 'Telegram', 'telegram.org': 'Telegram',
    'tiktok.com': 'TikTok', 'dribbble.com': 'Dribbble'
  };
  function socialLabel(url) {
    if (/^mailto:/i.test(url)) return 'Email';
    var host = '';
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return url; }
    return SOCIAL_DOMAIN_MAP[host] || host || url;
  }

  function syncContactAndLinks(doc, state, lang) {
    var c = state.contact;
    var links = (state.socialLinks || []).map(function (l) { return safeSocialUrl(l.url); }).filter(Boolean);

    // Botones del hero: un <a> por link social, mismo orden y clases que
    // arma public/index.php — Email ya no se agrega aparte, ahora es un
    // chip más de redes sociales si el admin decide agregarlo (punto 1).
    var heroCta = doc.querySelector('.hero__cta');
    if (heroCta) {
      heroCta.innerHTML = links.map(function (url) {
        return '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener" class="btn btn-ghost">' + escapeHtml(socialLabel(url)) + ' ↗</a>';
      }).join('');
    }

    // "Ver todos mis proyectos en GitHub" — solo si hay un link de GitHub.
    var seeAllWrap = doc.querySelector('a[data-i18n="p.all"]');
    seeAllWrap = seeAllWrap ? seeAllWrap.parentElement : null;
    var githubUrl = links.filter(function (u) { return socialLabel(u) === 'GitHub'; })[0];
    if (seeAllWrap) {
      seeAllWrap.hidden = !githubUrl;
      var seeAllLink = seeAllWrap.querySelector('a');
      if (seeAllLink && githubUrl) seeAllLink.setAttribute('href', githubUrl);
    }

    // Insignia de disponibilidad + tarjeta de contacto.
    var badge = doc.querySelector('.availability-badge__text[data-i18n-dynamic]');
    if (badge) {
      badge.setAttribute('data-es', fallbackEs(c.badge, c.badgeEn));
      badge.setAttribute('data-en', fallbackEn(c.badge, c.badgeEn));
    }
    var badgeDot = doc.querySelector('.availability-badge__dot');
    if (badgeDot) badgeDot.setAttribute('style', dotColorStyle(c.badgeColor));
    var badgeWrap = doc.querySelector('.availability-badge');
    if (badgeWrap) badgeWrap.setAttribute('style', badgeColorStyle(c.badgeColor));

    // Contacto ya no repite los links de redes sociales de Inicio (punto 10)
    // — es su propia lista independiente; si el admin quiere una red social
    // también aquí, la agrega como un renglón más en Contacto.
    var contactLinks = doc.querySelector('.contact-links');
    if (contactLinks) {
      contactLinks.innerHTML = (c.items || []).map(function (item) {
        var href = contactLinkHref(item.value || '');
        var label = '<span class="contact-link__label"' + dynAttrs(item.label, item.labelEn) + '>' + escapeHtml(pick(item.label, item.labelEn, lang)) + '</span>';
        var value = '<span class="contact-link__value">' + escapeHtml(item.value || '') + '</span>';
        return href
          ? '<a href="' + escapeAttr(href) + '" class="contact-link">' + label + value + '</a>'
          : '<div class="contact-link">' + label + value + '</div>';
      }).join('');
    }
  }

  function educationEntriesHtml(entries, lang) {
    return entries.map(function (edu) {
      var dateText = window.MPVDatepicker.formatDateRange(edu.startDate, edu.isCurrent ? null : edu.endDate, lang);
      return '' +
        '<div class="edu-block">' +
          '<h3 class="edu-block__degree"' + dynAttrs(edu.degree, edu.degreeEn) + '>' + escapeHtml(pick(edu.degree, edu.degreeEn, lang)) + '</h3>' +
          '<p class="edu-block__org"' + dynAttrs(edu.org, edu.orgEn) + '>' + escapeHtml(pick(edu.org, edu.orgEn, lang)) + '</p>' +
          '<p class="edu-block__dates">' + escapeHtml(dateText) + '</p>' +
          '<span class="status-pill"' + dynAttrs(edu.status, edu.statusEn) + '>' + escapeHtml(pick(edu.status, edu.statusEn, lang)) + '</span>' +
        '</div>';
    }).join('');
  }

  /* ---------- orquestación ---------- */

  function fullSync(iframe, state, i18nDict, lang) {
    var doc = iframe.contentDocument;
    var win = iframe.contentWindow;
    if (!doc || !win) return;
    var utils = window.MPVAdmin.utils;
    var i18n = i18nDict[lang] || i18nDict.es;

    // El iframe de vista previa no es "un visitante" con su propio tema: se
    // fuerza a que refleje el mismo tema que el admin ve ahora mismo en el
    // dashboard (window.MPVAdmin.theme, ver admin-sections.js), no un valor
    // de BD por visitante (eso ya no existe).
    var dashboardTheme = window.MPVAdmin.theme === 'light' ? 'light' : 'dark';
    doc.documentElement.setAttribute('data-theme', dashboardTheme);
    // La etiqueta visible del botón de tema la controla el theme.js del
    // propio iframe con SU estado interno (sessionStorage/sistema) — no sabe
    // que forzamos el atributo desde afuera, así que hay que corregirla a
    // mano o queda mostrando el nombre del tema contrario al que se ve.
    var themeLabel = doc.querySelector('[data-theme-label]');
    if (themeLabel) themeLabel.textContent = dashboardTheme === 'light' ? (i18n['theme.light'] || 'Claro') : (i18n['theme.dark'] || 'Oscuro');
    // Mismo motivo que la etiqueta: el ícono sol/luna lo pinta el theme.js
    // del propio iframe con SU estado interno, así que hay que corregirlo a
    // mano para que combine con el data-theme que acabamos de forzar.
    var themeIcon = doc.querySelector('[data-theme-icon]');
    if (themeIcon && win.MPVIcons) themeIcon.innerHTML = dashboardTheme === 'light' ? win.MPVIcons.sun : win.MPVIcons.moon;

    syncHero(doc, state, lang);
    syncContactAndLinks(doc, state, lang);

    var eduList = doc.querySelector('.edu-list');
    if (eduList) eduList.innerHTML = educationEntriesHtml(state.educationEntries, lang);

    var certList = doc.querySelector('.cert-list');
    if (certList) certList.innerHTML = certsHtml(state.certifications, lang);

    var langList = doc.querySelector('.lang-list');
    if (langList) langList.innerHTML = langListHtml(state.education, lang, utils, i18n['ed.langsL'] || 'Idiomas');

    var skillsGrid = doc.querySelector('.skills-grid');
    if (skillsGrid) skillsGrid.innerHTML = skillsGridHtml(state.skills, lang);

    var timeline = doc.querySelector('.timeline');
    if (timeline) timeline.innerHTML = experienceHtml(state.experience, lang, utils);

    var section = doc.getElementById('projects');
    if (section) {
      var grid = section.querySelector('.projects-grid');
      var existingFlagship = section.querySelector('.flagship');
      var flagship = null, flagshipIndex = -1;
      var others = [];
      state.projects.forEach(function (p, i) {
        if (p.flagship && flagship === null) { flagship = p; flagshipIndex = i; }
        else others.push({ p: p, i: i });
      });
      if (flagship) {
        var html = flagshipHtml(flagship, flagshipIndex, i18n, lang, utils.splitCsv(flagship.stackStr));
        if (existingFlagship) existingFlagship.outerHTML = html;
        else if (grid) grid.insertAdjacentHTML('beforebegin', html);
      } else if (existingFlagship) {
        existingFlagship.remove();
      }
      if (grid) {
        grid.innerHTML = others.map(function (o) {
          return projectCardHtml(o.p, o.i, i18n, lang, utils.splitCsv(o.p.stackStr));
        }).join('');
      }
    }

    // Strings estáticas de interfaz ([data-i18n]) + refuerzo de las dinámicas
    // recién escritas ([data-i18n-dynamic]) — reimplementado aquí (no se
    // llama a window.MPV.i18n.applyLang() del propio iframe) para no
    // persistir el idioma de vista previa en el localStorage real del sitio.
    doc.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (i18n[key] != null) el.textContent = i18n[key];
    });
    doc.querySelectorAll('[data-i18n-dynamic]').forEach(function (el) {
      var value = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-es');
      if (value != null) el.textContent = value;
    });
    doc.querySelectorAll('[data-lang-label]').forEach(function (el) {
      el.textContent = lang === 'en' ? 'ES' : 'EN';
    });
    doc.documentElement.lang = lang;

    // scroll-reveal.js solo observa los [data-reveal] que existían en el
    // documento al cargar la página — cualquier tarjeta que reconstruimos
    // aquí (proyectos, habilidades, experiencia) es un nodo nuevo que ese
    // observer nunca ve, así que se quedaría en opacity:0 para siempre
    // (su estado inicial en animations.css). Como esto es una vista previa,
    // no un scroll real de un visitante, se revela todo de inmediato en vez
    // de esperar una intersección que nunca va a llegar.
    doc.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(function (el) {
      el.classList.add('is-revealed');
    });
  }

  var iframeEl, i18nDict = null, ready = false;

  function currentLang() {
    return window.MPVAdmin.editLang === 'en' ? 'en' : 'es';
  }

  function render() {
    if (!ready || !i18nDict) return;
    fullSync(iframeEl, window.MPVAdmin.state, i18nDict, currentLang());
    // admin-preview-highlight.js necesita re-aplicar el resaltado DESPUÉS de
    // que el iframe se reconstruyó (el nodo que tenía resaltado antes ya no
    // existe) — antes escuchaba "mpv-admin:change" directamente, lo cual
    // funcionaba solo porque este listener se registra primero y ambos eran
    // síncronos. Con el debounce de más abajo, "mpv-admin:change" ya no
    // coincide con el momento real en que termina de dibujarse, así que este
    // evento aparte marca exactamente cuándo el DOM nuevo ya existe.
    document.dispatchEvent(new CustomEvent('mpv-admin:previewrendered'));
  }

  // Neutraliza el toggle de tema/idioma DEL SITIO dentro del iframe — ver
  // docblock de arriba. Todo lo demás (scroll, anclas del menú, abrir el CV)
  // sigue funcionando con normalidad.
  function guardAgainstLocalStorageSideEffects(doc) {
    doc.addEventListener('click', function (e) {
      var el = e.target.closest('[data-theme-toggle], [data-lang-toggle]');
      if (el) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
  }

  function handleIframeLoad() {
    var doc = iframeEl.contentDocument;
    if (!doc) return;
    var dataEl = doc.getElementById('i18n-data');
    try { i18nDict = JSON.parse(dataEl.textContent); } catch (e) { i18nDict = { es: {}, en: {} }; }
    guardAgainstLocalStorageSideEffects(doc);
    ready = true;
    render();
  }

  // Al cambiar de pestaña en el dashboard, la vista previa se desplaza a la
  // sección correspondiente del sitio real — mismo espíritu que el
  // resaltado de campo↔vista previa, pero a nivel de sección completa.
  var SECTION_ANCHORS = {
    hero: 'top', projects: 'projects', skills: 'skills',
    experience: 'experience', education: 'education', contact: 'contact',
  };

  document.addEventListener('DOMContentLoaded', function () {
    iframeEl = document.querySelector('[data-preview-frame]');
    if (!iframeEl) return;
    iframeEl.addEventListener('load', handleIframeLoad);

    document.querySelectorAll('[data-section-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var anchor = SECTION_ANCHORS[btn.getAttribute('data-section-btn')];
        if (!anchor || !ready) return;
        var target = iframeEl.contentDocument.getElementById(anchor);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });
  // render() reconstruye con innerHTML los bloques que se repiten (proyectos,
  // habilidades, experiencia, certificaciones, idiomas — ver docblock de
  // arriba) enteros, no solo el campo que cambió. Escribir en un textarea
  // dispara "mpv-admin:change" en CADA tecla, así que sin este debounce cada
  // letra reconstruía TODO ese HTML en el iframe — redundante e imperceptible
  // con el puñado de proyectos/habilidades típico de este sitio, pero se
  // notaría con listas largas. Se agrupan las reconstrucciones mientras el
  // admin sigue escribiendo y solo se dibuja una vez que hace una pausa.
  // mpv-admin:editlangchange es un clic explícito (no una ráfaga de teclas),
  // así que ese sí se sigue redibujando de inmediato. Lo mismo para
  // notifyChange(true) (ver admin-state.js) — un color elegido, un
  // interruptor, etc. no son una ráfaga que agrupar, así que se dibujan sin
  // esperar el agrupamiento.
  var renderDebounceTimer = null;
  document.addEventListener('mpv-admin:change', function (e) {
    if (e.detail && e.detail.immediate) {
      clearTimeout(renderDebounceTimer);
      render();
      return;
    }
    clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(render, 120);
  });
  document.addEventListener('mpv-admin:editlangchange', render);

  // API mínima para admin-preview-highlight.js: necesita el <iframe> y el
  // idioma activo para encontrar y resaltar el nodo correspondiente.
  window.MPVAdminPreview = {
    getFrame: function () { return iframeEl; },
  };
})();
