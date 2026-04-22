/* Multi UML Diagram Generator */
(function () {
  const STORAGE_KEYS = {
    diagram: 'uml-diagram-generator-state-v4',
    theme: 'uml-diagram-generator-theme'
  };

  const UI = {
    diagramType: document.getElementById('diagramType'),
    description: document.getElementById('description'),
    statusMessage: document.getElementById('statusMessage'),
    generateBtn: document.getElementById('generateBtn'),
    loadTemplateBtn: document.getElementById('loadTemplateBtn'),
    connectBtn: document.getElementById('connectBtn'),
    editBtn: document.getElementById('editBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    clearBtn: document.getElementById('clearBtn'),
    saveBtn: document.getElementById('saveBtn'),
    exportBtn: document.getElementById('exportBtn'),
    saveJsonBtn: document.getElementById('saveJsonBtn'),
    loadJsonBtn: document.getElementById('loadJsonBtn'),
    jsonFileInput: document.getElementById('jsonFileInput'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    resetZoomBtn: document.getElementById('resetZoomBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    typeChips: Array.from(document.querySelectorAll('.type-chip')),
    root: document.documentElement
  };

  const appState = { diagramType: 'class', text: '', theme: 'light' };
  let selectedCell = null;
  let connectSource = null;
  let scale = 1;

  const graph = new joint.dia.Graph();
  const paper = new joint.dia.Paper({
    el: document.getElementById('paper'),
    model: graph,
    width: 1400,
    height: 800,
    gridSize: 10,
    drawGrid: { name: 'mesh' },
    background: { color: 'transparent' },
    defaultLink: new joint.shapes.standard.Link({
      attrs: { line: { stroke: '#4f6b95', strokeWidth: 2, targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 z' } } }
    }),
    interactive: { linkMove: true }
  });

  function setStatus(message, kind = 'success') {
    UI.statusMessage.textContent = message;
    UI.statusMessage.style.color = kind === 'error' ? 'var(--danger)' : 'var(--success)';
  }

  function splitStatements(text) {
    return text.split(/[\n;]+/).map((line) => line.trim()).filter(Boolean);
  }

  function titleCase(text) {
    return text.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }

  function ensureClass(map, name) {
    if (!map[name]) map[name] = { name, attributes: [], methods: [] };
  }

  function makeLink(source, target, options = {}) {
    const link = new joint.shapes.standard.Link();
    link.source(source);
    link.target(target);
    if (options.label) link.labels([{ attrs: { text: { text: options.label, fontSize: 11 } } }]);
    if (options.inheritance) {
      link.attr('line/targetMarker', { type: 'path', d: 'M 16 -8 0 0 16 8 z', fill: '#fff', stroke: '#2f4a78' });
    }
    if (options.noMarker) {
      link.attr('line/targetMarker', null);
      link.attr('line/sourceMarker', null);
    }
    return link;
  }

  const DiagramModules = {
    class: {
      template: 'class User(id,name){login(),logout()}\nclass Admin(role){manageUsers()}\nAdmin extends User\nUser uses AuthService\nUser has Profile',
      parse(text) {
        const model = { classes: {}, relationships: [] };
        splitStatements(text).forEach((line) => {
          const classDef = line.match(/^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*(?:\{([^}]*)\})?$/i);
          const extendsMatch = line.match(/^([\w-]+)\s+extends\s+([\w-]+)$/i);
          const hasMatch = line.match(/^([\w-]+)\s+has\s+([\w-]+)$/i);
          const usesMatch = line.match(/^([\w-]+)\s+uses\s+([\w-]+)$/i);
          if (classDef) {
            const [, className, attrs = '', methods = ''] = classDef;
            model.classes[className] = { name: className, attributes: attrs.split(',').map((x) => x.trim()).filter(Boolean), methods: methods.split(',').map((x) => x.trim()).filter(Boolean) };
            return;
          }
          if (extendsMatch) {
            const [, child, parent] = extendsMatch;
            ensureClass(model.classes, child);
            ensureClass(model.classes, parent);
            model.relationships.push({ from: child, to: parent, type: 'inheritance', label: 'extends' });
            return;
          }
          if (hasMatch || usesMatch) {
            const match = hasMatch || usesMatch;
            const [, from, to] = match;
            ensureClass(model.classes, from);
            ensureClass(model.classes, to);
            model.relationships.push({ from, to, type: 'association', label: hasMatch ? 'has' : 'uses' });
            return;
          }
          if (/^[\w-]+$/.test(line)) ensureClass(model.classes, line);
        });
        return model;
      },
      render(parsed) {
        graph.clear();
        const byName = {};
        Object.values(parsed.classes).forEach((cls, index) => {
          const shape = new joint.shapes.standard.Rectangle();
          shape.position(60 + (index % 3) * 280, 40 + Math.floor(index / 3) * 210);
          shape.resize(230, 150);
          shape.attr({
            body: { fill: '#dbe7ff', stroke: '#4567a3', strokeWidth: 2, rx: 8, ry: 8 },
            label: { text: `${cls.name}\n----------------\n${cls.attributes.join('\n') || '(attributes)'}\n----------------\n${cls.methods.join('\n') || '(methods)'}`, fontSize: 12 }
          });
          shape.addTo(graph);
          byName[cls.name] = shape;
        });
        parsed.relationships.forEach((rel) => {
          if (!byName[rel.from] || !byName[rel.to]) return;
          makeLink(byName[rel.from], byName[rel.to], { label: rel.label, inheritance: rel.type === 'inheritance' }).addTo(graph);
        });
      }
    },
    usecase: {
      template: 'actor Customer\nactor Admin\nCustomer performs place order\nCustomer performs view cart\nAdmin performs manage inventory',
      parse(text) {
        const actors = new Set();
        const useCases = new Set();
        const links = [];
        splitStatements(text).forEach((line) => {
          const actorMatch = line.match(/^actor\s+([\w-]+)$/i);
          const performsMatch = line.match(/^([\w-]+)\s+performs\s+(.+)$/i);
          if (actorMatch) return actors.add(actorMatch[1]);
          if (performsMatch) {
            const actor = performsMatch[1];
            const useCase = titleCase(performsMatch[2]);
            actors.add(actor); useCases.add(useCase); links.push({ actor, useCase });
          }
        });
        return { actors: [...actors], useCases: [...useCases], links };
      },
      render(parsed) {
        graph.clear();
        const actorMap = {};
        const useCaseMap = {};
        parsed.actors.forEach((actor, i) => {
          const shape = new joint.shapes.standard.Circle();
          shape.position(70, 90 + i * 120); shape.resize(70, 70);
          shape.attr({ body: { fill: '#fff4db', stroke: '#b37b00', strokeWidth: 2 }, label: { text: actor, fontSize: 12 } });
          shape.addTo(graph); actorMap[actor] = shape;
        });
        parsed.useCases.forEach((uc, i) => {
          const shape = new joint.shapes.standard.Ellipse();
          shape.position(320, 70 + i * 105); shape.resize(230, 78);
          shape.attr({ body: { fill: '#ecffef', stroke: '#2b8a3e', strokeWidth: 2 }, label: { text: uc, fontSize: 12 } });
          shape.addTo(graph); useCaseMap[uc] = shape;
        });
        parsed.links.forEach((item) => {
          if (!actorMap[item.actor] || !useCaseMap[item.useCase]) return;
          makeLink(actorMap[item.actor], useCaseMap[item.useCase]).addTo(graph);
        });
      }
    },
    activity: {
      template: 'start\nthen validate input\nif valid\nthen process request\nthen show success\nend',
      parse(text) {
        const nodes = splitStatements(text).map((line) => {
          if (/^start$/i.test(line)) return { type: 'start', label: 'Start' };
          if (/^end$/i.test(line)) return { type: 'end', label: 'End' };
          if (/^if\s+/i.test(line)) return { type: 'decision', label: line };
          if (/^then\s+/i.test(line)) return { type: 'action', label: line.replace(/^then\s+/i, '') };
          return { type: 'action', label: line };
        });
        if (!nodes.length) return [{ type: 'start', label: 'Start' }, { type: 'action', label: 'Process' }, { type: 'end', label: 'End' }];
        if (!nodes.some((n) => n.type === 'start')) nodes.unshift({ type: 'start', label: 'Start' });
        if (!nodes.some((n) => n.type === 'end')) nodes.push({ type: 'end', label: 'End' });
        return nodes;
      },
      render(parsed) {
        graph.clear();
        const cells = [];
        parsed.forEach((node, i) => {
          const x = 300;
          const y = 40 + i * 110;
          let shape;
          if (node.type === 'start' || node.type === 'end') {
            shape = new joint.shapes.standard.Circle();
            shape.position(x + 80, y); shape.resize(60, 60);
            shape.attr({ body: { fill: node.type === 'start' ? '#d8f9e4' : '#ffdce1', stroke: '#2e8b57', strokeWidth: 2 }, label: { text: node.label, fontSize: 12 } });
          } else if (node.type === 'decision') {
            shape = new joint.shapes.standard.Path();
            shape.position(x + 50, y); shape.resize(120, 80);
            shape.attr({ body: { d: 'M 60 0 L 120 40 L 60 80 L 0 40 Z', fill: '#fff8d8', stroke: '#997a00', strokeWidth: 2 }, label: { text: node.label, fontSize: 11 } });
          } else {
            shape = new joint.shapes.standard.Rectangle();
            shape.position(x, y); shape.resize(220, 72);
            shape.attr({ body: { fill: '#dbe7ff', stroke: '#4567a3', strokeWidth: 2, rx: 8, ry: 8 }, label: { text: node.label, fontSize: 12 } });
          }
          shape.addTo(graph);
          cells.push(shape);
        });
        for (let i = 0; i < cells.length - 1; i += 1) makeLink(cells[i], cells[i + 1]).addTo(graph);
      }
    },
    sequence: {
      template: 'User sends login request to AuthService\nAuthService calls verify credentials on Database\nDatabase sends result to AuthService\nAuthService sends token to User',
      parse(text) {
        const participants = new Set();
        const messages = [];
        splitStatements(text).forEach((line) => {
          const sendsMatch = line.match(/^([\w-]+)\s+sends\s+(.+?)\s+to\s+([\w-]+)$/i);
          const callsMatch = line.match(/^([\w-]+)\s+calls\s+(.+?)\s+on\s+([\w-]+)$/i);
          const match = sendsMatch || callsMatch;
          if (!match) return;
          const [, from, message, to] = match;
          participants.add(from); participants.add(to);
          messages.push({ from, to, message: message.trim() });
        });
        return { participants: [...participants], messages };
      },
      render(parsed) {
        graph.clear();
        const heads = {};
        parsed.participants.forEach((name, i) => {
          const x = 90 + i * 220;
          const head = new joint.shapes.standard.Rectangle();
          head.position(x, 20); head.resize(170, 46);
          head.attr({ body: { fill: '#e6f8ff', stroke: '#007c99', strokeWidth: 2 }, label: { text: name, fontSize: 12 } });
          head.addTo(graph); heads[name] = head;
          makeLink({ x: x + 85, y: 66 }, { x: x + 85, y: 540 }, { noMarker: true })
            .attr('line/stroke', '#6e7d99').attr('line/strokeDasharray', '6 4').addTo(graph);
        });
        parsed.messages.forEach((msg, i) => {
          if (!heads[msg.from] || !heads[msg.to]) return;
          const y = 110 + i * 58;
          const fromX = heads[msg.from].position().x + 85;
          const toX = heads[msg.to].position().x + 85;
          makeLink({ x: fromX, y }, { x: toX, y }, { label: msg.message }).addTo(graph);
        });
      }
    }
  };

  function generateClassDiagram(text) { DiagramModules.class.render(DiagramModules.class.parse(text)); }
  function generateUseCaseDiagram(text) { DiagramModules.usecase.render(DiagramModules.usecase.parse(text)); }
  function generateActivityDiagram(text) { DiagramModules.activity.render(DiagramModules.activity.parse(text)); }
  function generateSequenceDiagram(text) { DiagramModules.sequence.render(DiagramModules.sequence.parse(text)); }

  function generateDiagramByType(type, text) {
    ({ class: generateClassDiagram, usecase: generateUseCaseDiagram, activity: generateActivityDiagram, sequence: generateSequenceDiagram }[type] || generateClassDiagram)(text);
  }

  function setActiveType(type) {
    appState.diagramType = type;
    UI.diagramType.value = type;
    UI.typeChips.forEach((chip) => chip.classList.toggle('active', chip.dataset.diagramType === type));
  }

  function setTheme(theme) {
    appState.theme = theme === 'dark' ? 'dark' : 'light';
    UI.root.setAttribute('data-theme', appState.theme);
    UI.themeToggleBtn.setAttribute('aria-pressed', String(appState.theme === 'dark'));
    UI.themeToggleBtn.innerHTML = appState.theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    localStorage.setItem(STORAGE_KEYS.theme, appState.theme);
  }

  function generateDiagram() {
    appState.diagramType = UI.diagramType.value;
    appState.text = UI.description.value.trim();
    generateDiagramByType(appState.diagramType, appState.text);
    saveDiagramState();
    setStatus('Diagram generated successfully.');
  }

  function loadTemplate() {
    UI.description.value = DiagramModules[appState.diagramType].template;
    setStatus('Template loaded. Click Generate Diagram to render.');
  }

  function saveDiagramState() {
    localStorage.setItem(STORAGE_KEYS.diagram, JSON.stringify({ diagramType: appState.diagramType, text: appState.text, graph: graph.toJSON() }));
  }

  function loadAppState() {
    setTheme(localStorage.getItem(STORAGE_KEYS.theme) || 'light');
    const raw = localStorage.getItem(STORAGE_KEYS.diagram);
    if (!raw) return setActiveType('class');
    try {
      const saved = JSON.parse(raw);
      setActiveType(saved.diagramType || 'class');
      appState.text = saved.text || '';
      UI.description.value = appState.text;
      if (saved.graph?.cells?.length) graph.fromJSON(saved.graph);
      setStatus('Loaded previous diagram from local storage.');
    } catch (error) {
      setActiveType('class');
      setStatus('Could not load previous diagram state.', 'error');
      console.warn(error);
    }
  }

  function clearDiagram() {
    graph.clear();
    selectedCell = null;
    connectSource = null;
    saveDiagramState();
    setStatus('Diagram cleared.');
  }

  function deleteSelected() {
    if (!selectedCell) return setStatus('Select an element before deleting.', 'error');
    selectedCell.remove();
    selectedCell = null;
    saveDiagramState();
    setStatus('Element deleted.');
  }

  function editSelected() {
    if (!selectedCell) return setStatus('Select an element before editing.', 'error');
    const next = prompt('Edit element label:', selectedCell.attr('label/text') || '');
    if (next === null) return;
    selectedCell.attr('label/text', next);
    saveDiagramState();
    setStatus('Element updated.');
  }

  function connectSelected() {
    if (!selectedCell) return setStatus('Select an element to connect.', 'error');
    if (!connectSource) {
      connectSource = selectedCell;
      return setStatus('Source selected. Select target element and click Connect.');
    }
    if (connectSource.id !== selectedCell.id) {
      makeLink(connectSource, selectedCell).addTo(graph);
      saveDiagramState();
      setStatus('Elements connected.');
    }
    connectSource = null;
  }

  function exportPNG() {
    const timestamp = Date.now();
    paper.toPNG((dataURL) => {
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `uml-diagram-${timestamp}.png`;
      link.click();
      setStatus('PNG exported successfully.');
    }, { padding: 20, backgroundColor: '#ffffff' });
  }

  function saveJSON() {
    try {
      const data = JSON.stringify(graph.toJSON(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'uml-diagram.json';
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Diagram saved successfully as JSON.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to save JSON file.', 'error');
    }
  }

  function loadJSON(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target.result || '{}'));
        graph.fromJSON(parsed);
        saveDiagramState();
        setStatus('Diagram loaded successfully from JSON.');
      } catch (error) {
        console.error(error);
        setStatus('Invalid JSON file. Please upload a valid diagram JSON.', 'error');
      }
    };

    reader.onerror = () => {
      setStatus('Failed to read JSON file.', 'error');
    };

    reader.readAsText(file);
  }

  function zoom(delta) {
    scale = Math.max(0.3, Math.min(2, scale + delta));
    paper.scale(scale, scale);
  }

  function resetZoom() {
    scale = 1;
    paper.scale(1, 1);
    paper.translate(0, 0);
    setStatus('Zoom reset.');
  }

  function enablePanning() {
    let pointerStart = null;
    let baseOffset = { tx: 0, ty: 0 };
    paper.on('blank:pointerdown', (evt, x, y) => { pointerStart = { x, y }; baseOffset = paper.translate(); });
    paper.on('blank:pointermove', (evt, x, y) => {
      if (!pointerStart) return;
      paper.translate(baseOffset.tx + (x - pointerStart.x), baseOffset.ty + (y - pointerStart.y));
    });
    paper.on('blank:pointerup', () => { pointerStart = null; });
  }

  function attachEvents() {
    UI.generateBtn.addEventListener('click', generateDiagram);
    UI.loadTemplateBtn.addEventListener('click', loadTemplate);
    UI.saveBtn.addEventListener('click', () => { saveDiagramState(); setStatus('Diagram saved locally.'); });
    UI.clearBtn.addEventListener('click', clearDiagram);
    UI.deleteBtn.addEventListener('click', deleteSelected);
    UI.editBtn.addEventListener('click', editSelected);
    UI.connectBtn.addEventListener('click', connectSelected);
    UI.exportBtn.addEventListener('click', exportPNG);
    UI.saveJsonBtn.addEventListener('click', saveJSON);
    UI.loadJsonBtn.addEventListener('click', () => UI.jsonFileInput.click());
    UI.jsonFileInput.addEventListener('change', (event) => {
      loadJSON(event.target.files && event.target.files[0]);
      UI.jsonFileInput.value = '';
    });
    UI.zoomInBtn.addEventListener('click', () => zoom(0.1));
    UI.zoomOutBtn.addEventListener('click', () => zoom(-0.1));
    UI.resetZoomBtn.addEventListener('click', resetZoom);
    UI.themeToggleBtn.addEventListener('click', () => setTheme(appState.theme === 'dark' ? 'light' : 'dark'));

    UI.diagramType.addEventListener('change', (event) => {
      setActiveType(event.target.value);
      saveDiagramState();
    });

    UI.typeChips.forEach((chip) => chip.addEventListener('click', () => {
      setActiveType(chip.dataset.diagramType);
      saveDiagramState();
    }));

    graph.on('change add remove', _.debounce(saveDiagramState, 250));
    paper.on('element:pointerclick', (elementView) => { selectedCell = elementView.model; });
    paper.on('element:pointerdblclick', (elementView) => { selectedCell = elementView.model; editSelected(); });
    paper.on('blank:pointerclick', () => { selectedCell = null; });
    enablePanning();
  }

  attachEvents();
  loadAppState();
})();