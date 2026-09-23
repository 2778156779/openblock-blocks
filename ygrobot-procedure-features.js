/**
 * YGrobot additions for custom procedures.
 *
 * This file is deliberately loaded after OpenBlock's generated Blockly
 * bundle.  The upstream project still needs retired Python 2 tooling to
 * regenerate its whole engine, while these small overrides keep our feature
 * code readable, versioned, and buildable with the local Node toolchain.
 */
'use strict';

var DEFAULT_COLOUR = '#FF6680';

module.exports = function(Blockly) {
  var procedureUtils = Blockly.ScratchBlocks.ProcedureUtils;

  /**
   * A procedure prototype holds the mutation XML, while its parent definition
   * block draws the visible outer header. Apply the same colour to both.
   */
  var applyProcedureColour = function(block, colour) {
    block.procedureColour_ = colour;
    block.setColour(colour);
    var parent = block.getParent && block.getParent();
    if (parent && parent.type === Blockly.PROCEDURES_DEFINITION_BLOCK_TYPE) {
      parent.procedureColour_ = colour;
      parent.setColour(colour);
    }
  };

  /**
   * Make every collapse entry point behave correctly for a procedure
   * definition, including Blockly's built-in "Collapse Block" command.
   * A procedure's prototype is its visible header: it contains the name and
   * shape that identify the definition. Only the stack attached after that
   * prototype is the foldable body.
   */
  var originalSetCollapsed = Blockly.BlockSvg.prototype.setCollapsed;
  Blockly.BlockSvg.prototype.setCollapsed = function(collapsed) {
    if (this.type !== Blockly.PROCEDURES_DEFINITION_BLOCK_TYPE) {
      originalSetCollapsed.call(this, collapsed);
      return;
    }
    if (this.collapsed_ === collapsed) return;

    // Store the normal Blockly collapsed state so undo/save/load continue to
    // work, but do not hide the definition's header input or replace its name
    // with Blockly's abbreviated collapsed label.
    Blockly.Block.prototype.setCollapsed.call(this, collapsed);
    var input = this.getInput('custom_block');
    var prototype = input && input.connection && input.connection.targetBlock();
    // In this Blockly version, users can attach a definition body below the
    // definition root or below its prototype. Cover both connection paths.
    var bodyConnections = [this.nextConnection];
    if (prototype) bodyConnections.push(prototype.nextConnection);
    var renderList = [];
    for (var i = 0; i < bodyConnections.length; i++) {
      var bodyConnection = bodyConnections[i];
      if (!bodyConnection || !bodyConnection.targetBlock()) continue;
      if (collapsed) {
        bodyConnection.hideAll();
      } else {
        renderList.push.apply(renderList, bodyConnection.unhideAll());
      }
      var body = bodyConnection.targetBlock();
      var descendants = body.getDescendants(false);
      for (var j = 0; j < descendants.length; j++) {
        var svgRoot = descendants[j].getSvgRoot && descendants[j].getSvgRoot();
        if (svgRoot) svgRoot.style.display = collapsed ? 'none' : 'block';
      }
    }
    if (!collapsed && this.rendered) {
      for (var k = 0; k < renderList.length; k++) renderList[k].render();
      this.render();
    }
  };

  var setProcedureDefinitionCollapsed = function(definition, collapsed) {
    definition.setCollapsed(collapsed);
  };

  var callerMutationToDom = procedureUtils.callerMutationToDom;
  procedureUtils.callerMutationToDom = function() {
    var mutation = callerMutationToDom.call(this);
    mutation.setAttribute('colour', this.procedureColour_ || DEFAULT_COLOUR);
    if (this.procedureOrder_ !== undefined) {
      mutation.setAttribute('order', this.procedureOrder_);
    }
    return mutation;
  };

  var callerDomToMutation = procedureUtils.callerDomToMutation;
  procedureUtils.callerDomToMutation = function(mutation) {
    callerDomToMutation.call(this, mutation);
    this.procedureColour_ = mutation.getAttribute('colour') || DEFAULT_COLOUR;
    this.procedureOrder_ = mutation.hasAttribute('order') ?
      Number(mutation.getAttribute('order')) : undefined;
    this.setColour(this.procedureColour_);
  };

  var definitionMutationToDom = procedureUtils.definitionMutationToDom;
  procedureUtils.definitionMutationToDom = function() {
    var mutation = definitionMutationToDom.call(this);
    mutation.setAttribute('colour', this.procedureColour_ || DEFAULT_COLOUR);
    if (this.procedureOrder_ !== undefined) {
      mutation.setAttribute('order', this.procedureOrder_);
    }
    return mutation;
  };

  var definitionDomToMutation = procedureUtils.definitionDomToMutation;
  procedureUtils.definitionDomToMutation = function(mutation) {
    definitionDomToMutation.call(this, mutation);
    var colour = mutation.getAttribute('colour') || DEFAULT_COLOUR;
    applyProcedureColour(this, colour);
    this.procedureOrder_ = mutation.hasAttribute('order') ?
      Number(mutation.getAttribute('order')) : undefined;
  };

  // Blockly copies these function references when block definitions are
  // registered. Rebind the real block types after installing our overrides;
  // changing ProcedureUtils alone would leave existing blocks on the old
  // pink-only deserializers.
  Blockly.Blocks.procedures_call.mutationToDom = procedureUtils.callerMutationToDom;
  Blockly.Blocks.procedures_call.domToMutation = procedureUtils.callerDomToMutation;
  Blockly.Blocks.procedures_prototype.mutationToDom = procedureUtils.definitionMutationToDom;
  Blockly.Blocks.procedures_prototype.domToMutation = procedureUtils.definitionDomToMutation;
  Blockly.Blocks.procedures_declaration.mutationToDom = procedureUtils.definitionMutationToDom;
  Blockly.Blocks.procedures_declaration.domToMutation = procedureUtils.definitionDomToMutation;

  Blockly.Procedures.sortProcedureMutations_ = function(mutations) {
    return mutations.slice().sort(function(a, b) {
      var hasAOrder = a.hasAttribute('order');
      var hasBOrder = b.hasAttribute('order');
      var aOrder = hasAOrder ? Number(a.getAttribute('order')) : null;
      var bOrder = hasBOrder ? Number(b.getAttribute('order')) : null;
      if (hasAOrder && hasBOrder && !isNaN(aOrder) && !isNaN(bOrder) && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      if (hasAOrder && !hasBOrder) return -1;
      if (!hasAOrder && hasBOrder) return 1;
      return a.getAttribute('proccode').localeCompare(b.getAttribute('proccode'));
    });
  };

  Blockly.Procedures.getNextOrder_ = function(workspace) {
    var highest = -1;
    Blockly.Procedures.allProcedureMutations(workspace).forEach(function(mutation) {
      if (mutation.hasAttribute('order')) {
        highest = Math.max(highest, Number(mutation.getAttribute('order')));
      }
    });
    return highest + 1;
  };

  Blockly.Procedures.moveProcedure_ = function(workspace, procCode, direction) {
    if (workspace.procedureOrderLocked_) return;
    var mutations = Blockly.Procedures.sortProcedureMutations_(
      Blockly.Procedures.allProcedureMutations(workspace));
    var index = -1;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].getAttribute('proccode') === procCode) index = i;
    }
    var targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= mutations.length) return;
    // Older projects have no order attribute. Assign a stable starting order
    // the first time their list is rearranged.
    mutations.forEach(function(mutation, mutationIndex) {
      var prototype = Blockly.Procedures.getPrototypeBlock(
        mutation.getAttribute('proccode'), workspace);
      if (prototype && prototype.procedureOrder_ === undefined) {
        prototype.procedureOrder_ = mutationIndex;
      }
    });
    var current = Blockly.Procedures.getPrototypeBlock(procCode, workspace);
    var otherCode = mutations[targetIndex].getAttribute('proccode');
    var other = Blockly.Procedures.getPrototypeBlock(otherCode, workspace);
    if (!current || !other) return;
    var currentOrder = current.procedureOrder_;
    current.procedureOrder_ = other.procedureOrder_;
    other.procedureOrder_ = currentOrder;
    workspace.refreshToolboxSelection_();
  };

  /**
   * Move one procedure to a precise position in the flyout order.  Unlike the
   * context-menu up/down action this supports a drag drop target, but it uses
   * the same `order` field so the result is saved with the project.
   */
  Blockly.Procedures.reorderProcedure_ = function(workspace, procCode,
      targetProcCode, insertAfter) {
    if (workspace.procedureOrderLocked_ || procCode === targetProcCode) return;
    var mutations = Blockly.Procedures.sortProcedureMutations_(
      Blockly.Procedures.allProcedureMutations(workspace));
    var source = null;
    var remaining = [];
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].getAttribute('proccode') === procCode) {
        source = mutations[i];
      } else {
        remaining.push(mutations[i]);
      }
    }
    if (!source) return;
    var targetIndex = -1;
    for (var j = 0; j < remaining.length; j++) {
      if (remaining[j].getAttribute('proccode') === targetProcCode) {
        targetIndex = j;
        break;
      }
    }
    if (targetIndex < 0) return;
    remaining.splice(targetIndex + (insertAfter ? 1 : 0), 0, source);
    remaining.forEach(function(mutation, order) {
      var prototype = Blockly.Procedures.getPrototypeBlock(
        mutation.getAttribute('proccode'), workspace);
      if (prototype) prototype.procedureOrder_ = order;
    });
    workspace.refreshToolboxSelection_();
  };

  var findProcedureDropTarget = function(flyout, event) {
    // The background is the visible drop area; the SVG group can also include
    // off-screen blocks from other categories in the scrolling flyout.
    var flyoutSvg = flyout.svgBackground_ || flyout.svgGroup_;
    if (!flyoutSvg) return null;
    var flyoutRect = flyoutSvg.getBoundingClientRect();
    if (event.clientX < flyoutRect.left || event.clientX > flyoutRect.right ||
        event.clientY < flyoutRect.top || event.clientY > flyoutRect.bottom) {
      return null;
    }
    var candidates = flyout.workspace_.getTopBlocks(false).filter(function(block) {
      return block.type === 'procedures_call';
    });
    var closest = null;
    var closestDistance = Infinity;
    candidates.forEach(function(block) {
      var root = block.getSvgRoot();
      if (!root) return;
      var rect = root.getBoundingClientRect();
      var centre = (rect.top + rect.bottom) / 2;
      var distance = Math.abs(event.clientY - centre);
      if (distance < closestDistance) {
        closest = {block: block, insertAfter: event.clientY > centre};
        closestDistance = distance;
      }
    });
    return closest;
  };

  // The preview is a non-interactive SVG copy. The real flyout block stays in
  // its slot so Blockly's connections and hit rectangles are not moved.
  var showProcedureSortPreview = function(gesture, event) {
    var visual = gesture.procedureSortVisual_;
    if (!visual) {
      var root = gesture.targetBlock_.getSvgRoot();
      var rect = root.getBoundingClientRect();
      var bbox = root.getBBox();
      var doc = root.ownerDocument;
      var preview = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      preview.setAttribute('class', 'blocklySvg ygrobotProcedureDragPreview');
      preview.setAttribute('aria-hidden', 'true');
      preview.setAttribute('viewBox', [bbox.x, bbox.y, bbox.width, bbox.height].join(' '));
      preview.style.cssText = 'position:fixed;pointer-events:none;overflow:visible;' +
        'z-index:10000;margin:0;background:transparent;filter:drop-shadow(0 3px 3px #0004);';
      preview.style.width = rect.width + 'px';
      preview.style.height = rect.height + 'px';
      var clone = root.cloneNode(true);
      clone.removeAttribute('transform');
      clone.removeAttribute('id');
      var ids = clone.querySelectorAll('[id]');
      for (var i = 0; i < ids.length; i++) ids[i].removeAttribute('id');
      preview.appendChild(clone);
      var marker = doc.createElement('div');
      marker.className = 'ygrobotProcedureDropMarker';
      marker.setAttribute('aria-hidden', 'true');
      marker.style.cssText = 'position:fixed;pointer-events:none;height:3px;' +
        'border-radius:2px;background:#3373cc;z-index:10001;display:none;';
      doc.body.appendChild(preview);
      doc.body.appendChild(marker);
      visual = gesture.procedureSortVisual_ = {
        root: root, opacity: root.style.opacity, rect: rect,
        preview: preview, marker: marker, doc: doc
      };
      root.style.opacity = '0.25';
      visual.cancel = function() { gesture.cancel(); };
      visual.keydown = function(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          gesture.cancel();
        }
      };
      doc.addEventListener('keydown', visual.keydown, true);
      doc.defaultView.addEventListener('blur', visual.cancel);
    }
    var delta = gesture.currentDragDeltaXY_;
    visual.preview.style.left = (visual.rect.left + delta.x) + 'px';
    visual.preview.style.top = (visual.rect.top + delta.y) + 'px';
    var target = findProcedureDropTarget(gesture.flyout_, event);
    visual.preview.style.opacity = target ? '0.95' : '0.45';
    visual.marker.style.display = 'none';
    if (target && target.block !== gesture.targetBlock_) {
      var targetRect = target.block.getSvgRoot().getBoundingClientRect();
      visual.marker.style.left = targetRect.left + 'px';
      visual.marker.style.top = (target.insertAfter ? targetRect.bottom + 5 :
        targetRect.top - 8) + 'px';
      visual.marker.style.width = Math.max(targetRect.width, visual.rect.width) + 'px';
      visual.marker.style.display = 'block';
    }
  };

  var clearProcedureSortPreview = function(gesture) {
    var visual = gesture.procedureSortVisual_;
    if (!visual) return;
    gesture.procedureSortVisual_ = null;
    visual.root.style.opacity = visual.opacity;
    visual.preview.remove();
    visual.marker.remove();
    visual.doc.removeEventListener('keydown', visual.keydown, true);
    visual.doc.defaultView.removeEventListener('blur', visual.cancel);
  };

  // Unlocking selects sort-only mode in every direction. Only locked entries
  // may create a call block in the coding workspace.
  var originalFlyoutDrag = Blockly.Gesture.prototype.updateIsDraggingFromFlyout_;
  Blockly.Gesture.prototype.updateIsDraggingFromFlyout_ = function() {
    var flyout = this.flyout_;
    var workspace = flyout && flyout.targetWorkspace_;
    var block = this.targetBlock_;
    if (workspace && workspace.procedureOrderLocked_ === false && block &&
        block.type === 'procedures_call') {
      this.procedureSort_ = true;
      return false;
    }
    return originalFlyoutDrag.call(this);
  };

  var originalFlyoutWorkspaceDrag = Blockly.Gesture.prototype
    .updateIsDraggingWorkspace_;
  Blockly.Gesture.prototype.updateIsDraggingWorkspace_ = function() {
    // After a sorting drag is prevented from creating a new block, Blockly
    // normally treats it as a flyout-scroll gesture. Keep that gesture idle;
    // handleUp below will use its drag delta to change the procedure order.
    if (this.procedureSort_) {
      return;
    }
    return originalFlyoutWorkspaceDrag.call(this);
  };

  var originalGestureHandleMove = Blockly.Gesture.prototype.handleMove;
  Blockly.Gesture.prototype.handleMove = function(event) {
    originalGestureHandleMove.call(this, event);
    if (this.procedureSort_) showProcedureSortPreview(this, event);
  };

  var originalGestureIsDragging = Blockly.Gesture.prototype.isDragging;
  Blockly.Gesture.prototype.isDragging = function() {
    return !!this.procedureSort_ || originalGestureIsDragging.call(this);
  };

  var originalGestureDispose = Blockly.Gesture.prototype.dispose;
  Blockly.Gesture.prototype.dispose = function() {
    clearProcedureSortPreview(this);
    this.procedureSort_ = false;
    return originalGestureDispose.call(this);
  };

  // Capture the destination while flyout blocks exist, then let Blockly
  // dispose the gesture BEFORE changing the list. refreshToolboxSelection_
  // refuses to refresh while workspace.currentGesture_ is still present.
  var originalGestureHandleUp = Blockly.Gesture.prototype.handleUp;
  Blockly.Gesture.prototype.handleUp = function(event) {
    var flyout = this.flyout_;
    var workspace = flyout && flyout.targetWorkspace_;
    var source = this.targetBlock_;
    var drop = null;
    if (this.procedureSort_ && workspace && source) {
      var target = findProcedureDropTarget(flyout, event);
      if (target && target.block !== source) {
        drop = {source: source.getProcCode(), target: target.block.getProcCode(),
          after: target.insertAfter};
      }
    }
    var result = originalGestureHandleUp.call(this, event);
    if (drop) {
      Blockly.Procedures.reorderProcedure_(workspace, drop.source,
        drop.target, drop.after);
    }
    return result;
  };

  var flyoutCategory = Blockly.Procedures.flyoutCategory;
  Blockly.Procedures.flyoutCategory = function(workspace) {
    if (workspace.procedureOrderLocked_ === undefined) {
      workspace.procedureOrderLocked_ = true;
    }
    var xmlList = flyoutCategory.call(this, workspace);
    var button = document.createElement('button');
    var callbackKey = 'YGROBOT_TOGGLE_PROCEDURE_ORDER_LOCK';
    // The icon shows the current state (rather than the action): closed lock
    // means normal drag-to-workspace mode, open lock means list sort mode.
    button.setAttribute('text', workspace.procedureOrderLocked_ ?
      '🔒 排序已锁定' : '🔓 拖动排序中');
    button.setAttribute('callbackKey', callbackKey);
    workspace.registerButtonCallback(callbackKey, function() {
      workspace.procedureOrderLocked_ = !workspace.procedureOrderLocked_;
      workspace.refreshToolboxSelection_();
    });
    xmlList.splice(1, 0, button);
    return xmlList;
  };

  var createProcedureCallbackFactory = Blockly.Procedures.createProcedureCallbackFactory_;
  Blockly.Procedures.createProcedureCallbackFactory_ = function(workspace) {
    var callback = createProcedureCallbackFactory.call(this, workspace);
    return function(mutation) {
      if (mutation && !mutation.hasAttribute('order')) {
        mutation.setAttribute('order', Blockly.Procedures.getNextOrder_(workspace));
      }
      callback(mutation);
      if (mutation) {
        var definition = Blockly.Procedures.getDefineBlock(
          mutation.getAttribute('proccode'), workspace);
        if (definition) {
          applyProcedureColour(definition,
            mutation.getAttribute('colour') || DEFAULT_COLOUR);
        }
      }
    };
  };

  Blockly.Procedures.showProcedureDefCallback_ = function(block) {
    var workspace = block.workspace.isFlyout ?
      block.workspace.targetWorkspace : block.workspace;
    var definition = Blockly.Procedures.getDefineBlock(block.getProcCode(), workspace);
    if (!definition) return;
    if (definition.isCollapsed()) setProcedureDefinitionCollapsed(definition, false);
    workspace.centerOnBlock(definition.id);
  };

  var definitionMenu = Blockly.ScratchBlocks.VerticalExtensions
    .PROCEDURE_DEF_CONTEXTMENU;
  var originalDefinitionMenu = definitionMenu.customContextMenu;
  definitionMenu.customContextMenu = function(menuOptions) {
    originalDefinitionMenu.call(this, menuOptions);
    menuOptions.push({
      enabled: true,
      text: this.isCollapsed() ? '展开定义' : '折叠定义',
      callback: function() {
        setProcedureDefinitionCollapsed(this, !this.isCollapsed());
      }.bind(this)
    });
  };

  var callMenu = Blockly.ScratchBlocks.VerticalExtensions.PROCEDURE_CALL_CONTEXTMENU;
  var originalCallMenu = callMenu.customContextMenu;
  callMenu.customContextMenu = function(menuOptions) {
    originalCallMenu.call(this, menuOptions);
    menuOptions.push(Blockly.Procedures.makeShowDefinitionOption(this));
    var workspace = this.workspace.isFlyout ?
      this.workspace.targetWorkspace : this.workspace;
    var procCode = this.getProcCode();
    menuOptions.push({
      enabled: !workspace.procedureOrderLocked_,
      text: '向上移动',
      callback: function() {
        Blockly.Procedures.moveProcedure_(workspace, procCode, -1);
      }
    });
    menuOptions.push({
      enabled: !workspace.procedureOrderLocked_,
      text: '向下移动',
      callback: function() {
        Blockly.Procedures.moveProcedure_(workspace, procCode, 1);
      }
    });
  };
};
