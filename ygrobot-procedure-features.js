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
    this.procedureColour_ = mutation.getAttribute('colour') || DEFAULT_COLOUR;
    this.procedureOrder_ = mutation.hasAttribute('order') ?
      Number(mutation.getAttribute('order')) : undefined;
    this.setColour(this.procedureColour_);
  };

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

  var flyoutCategory = Blockly.Procedures.flyoutCategory;
  Blockly.Procedures.flyoutCategory = function(workspace) {
    if (workspace.procedureOrderLocked_ === undefined) {
      workspace.procedureOrderLocked_ = true;
    }
    var xmlList = flyoutCategory.call(this, workspace);
    var button = document.createElement('button');
    var callbackKey = 'YGROBOT_TOGGLE_PROCEDURE_ORDER_LOCK';
    button.setAttribute('text', workspace.procedureOrderLocked_ ?
      '解锁积木排序' : '锁定积木排序');
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
    };
  };

  Blockly.Procedures.showProcedureDefCallback_ = function(block) {
    var workspace = block.workspace.isFlyout ?
      block.workspace.targetWorkspace : block.workspace;
    var definition = Blockly.Procedures.getDefineBlock(block.getProcCode(), workspace);
    if (!definition) return;
    if (definition.isCollapsed()) definition.setCollapsed(false);
    workspace.centerOnBlock(definition.id);
  };

  var definitionMenu = Blockly.ScratchBlocks.VerticalExtensions
    .PROCEDURE_DEFINITION_CONTEXTMENU;
  var originalDefinitionMenu = definitionMenu.customContextMenu;
  definitionMenu.customContextMenu = function(menuOptions) {
    originalDefinitionMenu.call(this, menuOptions);
    menuOptions.push({
      enabled: true,
      text: this.isCollapsed() ? '展开定义' : '折叠定义',
      callback: function() {
        this.setCollapsed(!this.isCollapsed());
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
