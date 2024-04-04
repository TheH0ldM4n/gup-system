import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from "../helpers/effects.mjs";

import { SkillRoll } from "../controllers/skill-roll.mjs";
import { ItemRoll } from "../controllers/item-roll.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class DebilusActorSheet extends ActorSheet {

  constructor(...args) {
    super(...args);

    this._gameSetting = game.settings.get('debilus', 'setting');
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["debilus", "sheet", "actor"],
      width: 500,
      height: 500,
      resizable: false,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "aptitudes",
        },
      ],
    });
  }

  /** @override */
  get template() {
    return `systems/debilus/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.data;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // add the game setting to the context
    context.gameSetting = this._gameSetting;

    console.log('context', context);
    console.log("gameSetting", this._gameSetting);

    // Prepare character data and items.
    if (actorData.type == "character") {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == "npc") {
      this._prepareItems(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle ability scores.
    for (let [k, v] of Object.entries(context.system.abilities)) {
      v.label = game.i18n.localize(CONFIG.DEBILUS.abilities[k]) ?? k;
    }

    // Same for aptitudes
    for (let [k, v] of Object.entries(context.system.aptitudes)) {
      v.label = game.i18n.localize(CONFIG.DEBILUS.aptitudes[k]) ?? k;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const aptitudes = [];
    const competences = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to gear.
      if (i.type === "item") {
        gear.push(i);
      }
      // Append to aptitudes.
      else if (i.type === "aptitude") {
        aptitudes.push(i);
      }
      // Append to competences.
      else if (i.type === "competence") {
        competences.push(i);
      }
    }

    // Assign and return
    context.gear = gear;
    context.aptitudes = aptitudes;
    context.competences = competences;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    html.on("click", ".item-quantity-increase", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.increaseQuantity();
    });

    html.on("click", ".item-quantity-decrease", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.decreaseQuantity();
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on("click", ".effect-control", (ev) => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on("click", ".rollable", this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system["type"];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    let consumeItem = "";
    let useActions = "";
    let valueBonusForm = "";
    let rollBonusMalusForm = `<div class="form-group">
                            <label>Bonus/Malus jet</label>
                            <input type="number" name="bonusMalus" value="" autofocus>
                          </div>`;

    // Check if there is an active encounter
    const activeEncounter = game.combats.active;

    if (dataset.rollType === "item") {
      const itemId = element.closest(".item").dataset.itemId;
      this._item = this.actor.items.get(itemId);

      if (this._item.system.rollType === "none") {
        rollBonusMalusForm = "";
      }

      if(this._item.type === "item") {
        consumeItem = `<div class="form-group">
                          <label>Consommer l'objet</label>
                          <input type="checkbox" name="consumeItem" value="1">
                        </div>`;
      }

      if(this._item.system.actions > 0) {
        useActions = `<div class="form-group">
                        <label>Consommer les actions</label>
                        <input type="checkbox" name="useActions" value="1" ${activeEncounter ? "checked" : "disabled"}>
                      </div>`;
      }

      if (this._item.system.valueType !== "none") {
        const valueLabel = this._item.system.valueType === "damage" ? "dégâts" : "soins";
        valueBonusForm = `<div class="form-group">
                            <label>Bonus/Malus de ${valueLabel}</label>
                            <input type="number" name="valueBonusMalus" value="" autofocus>
                          </div>`;
      }

    }

    // If none of the above, we're dealing with a basic roll.
    if(rollBonusMalusForm === "" && valueBonusForm === "" && consumeItem === "" && useActions === "") {
      return this.composeItemRoll(this._item);
    }

    let dialog = new Dialog({
      title: "Paramètres du jet de dé",
      content: `<form>
                  ${rollBonusMalusForm}
                  ${valueBonusForm}
                  ${consumeItem}
                  ${useActions}
                </form>`,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: "OK",
          callback: (html) => {
            if (rollBonusMalusForm) {
              this._bonusMalus = parseInt(html.find('[name="bonusMalus"]')[0].value || 0);
            }
            if(valueBonusForm) {
              this._valueBonusMalus = parseInt(html.find('[name="valueBonusMalus"]')[0].value || 0);
            }
            if(consumeItem) {
              this._consumeItem = html.find('[name="consumeItem"]')[0].checked;
            }
            if(useActions) {
              this._useActions = html.find('[name="useActions"]')[0].checked;
            }

            // Handle item rolls.
            if (dataset.rollType) {
                if (this._item) {

                  // Check if the item is consumable
                  if(this._consumeItem) {
                    if(this._item.system.quantity <= 0) {
                      ui.notifications.error("Objet épuisé.");
                      return;
                    }
                    this._item.update({ "system.quantity": this._item.system.quantity - 1 });
                  }

                  // Check if the actor has enough actions
                  if(this._useActions) {
                    if(this.actor.system.attributes.actions.value - this._item.system.actions < 0) {
                      ui.notifications.error("Vous n'avez pas assez d'actions pour effectuer ceci.");
                      return;
                    }
                    this.actor.update({ "system.attributes.actions.value": this.actor.system.attributes.actions.value - this._item.system.actions });
                  }

                  // Check if cooldown is < 1
                  console.log("ITEM", this._item);
                  if(this._item.type === "competence" && this._item.system.cooldown.value > 0 && this._item.system.cooldown.remaining > 0 && activeEncounter) {
                    let turns = this._item.system.cooldown.remaining > 1 ? "tours" : "tour";
                    ui.notifications.error("Vous devez encore attendre " + this._item.system.cooldown.remaining + " " + turns + " avant de pouvoir réutiliser cette compétence.");
                    return;
                  } else if (this._item.type === "competence" && this._item.system.cooldown.value > 0 && activeEncounter) {
                    this._item.update({ "system.cooldown.remaining": this._item.system.cooldown.value });
                  }
                  
                  return this.composeItemRoll(this._item);
                }
            }

            // Handle rolls that supply the formula directly.
            if (dataset.roll) {
              this.composeRoll(dataset);
            }
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
        },
      },
      default: "ok",
    });

    return dialog.render(true);
  }

  /**
   * Compose dataset roll
   */
  async composeRoll(dataset) {
    // Fixed
    const formula = '1d20';
    const bonusMalus = this._bonusMalus;
    const critRange = "20";
    const type = dataset.type;

    // Check if the label is localized
    const labelKey = this._gameSetting + '.' + dataset.type + '.' + dataset.key;
    let keyTrans = game.i18n.localize(labelKey) ?? dataset.key;

    // Use either "de" or "d'" if first letter is a vowel (lowercase or uppercase)
    let liaison = ("aeiouy".includes(keyTrans.charAt(0).toLowerCase())) ? "d'" : "de ";

    const label = this.actor.name + " effectue un test " + liaison + keyTrans;
    const mod = '+' + dataset.roll;
    const img = dataset.img;

    let r = new SkillRoll(
      label,
      img,
      formula,
      mod,
      bonusMalus,
      critRange,
      null,
      type
    );

    return r.roll(this.actor);
  }

  /**
   * Compose item roll
   */
  async composeItemRoll(item) {
    const formula = '1d20';
    const bonusMalus = this._bonusMalus || 0;
    const critRange = "20";
    let mod = 0;
    let noRoll = false;

    const type = item.type;
    const label = this.actor.name + " utilise " + item.name;
    const img = item.img;
    const description = item.system.description;
    const actions = item.system.actions;
    const value = item.system.value;
    const valueType = item.system.valueType;

    if (item.system.rollType === "ability") {
      var rollType = this._gameSetting + '.ability.' + item.system.rollAbility;
    } else if (item.system.rollType === "aptitude") {
      var rollType = this._gameSetting + '.aptitude.' + item.system.rollAptitude;
    } else {
      var rollType = null;
    }

    if (item.system.rollType === "ability") {
      mod = '+' + this.actor.system.abilities[item.system.rollAbility].value;
    } else if (item.system.rollType === "aptitude") {
      mod = '+' + this.actor.system.aptitudes[item.system.rollAptitude].value;
    } else {
      mod = null;
      noRoll = true;
    }

    let r = new ItemRoll(
      label,
      img,
      formula,
      mod,
      bonusMalus,
      critRange,
      description,
      noRoll,
      actions,
      value,
      valueType,
      rollType,
      type,
      this._valueBonusMalus
    );

    return r.roll(this.actor);
  }

}
