/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class DebilusActor extends Actor {
  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the actor source data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.debilus || {};

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;
    const systemData = actorData.system;
    const ab = systemData.abilities;
    const att = systemData.attributes;
    const aptitudes = systemData.aptitudes;
    
    // Prevent attributes from going over max or under 0
    for (let [k, v] of Object.entries(att)) {
      if (v.value < 0) {
        v.value = 0;
      } else if (v.value > v.max) {
        v.value = v.max;
      }
    }

    // Prevent abilities from going under 0
    for (let [k, v] of Object.entries(ab)) {
      if (v.value < 0) {
        v.value = 0;
      }
    }
     
    // Health
    systemData.pv.max = 10 + 2 * ( att.level.value * (ab.corps.value > 0 ? ab.corps.value : 1) );
    if (systemData.pv.value < 0) {
      systemData.pv.value = 0;
    }
    if (systemData.pv.value > systemData.pv.max) {
      systemData.pv.value = systemData.pv.max;
    }
    
    // Defense, Flee & Initiative
    att.defense.value    = 10 + Math.floor((ab.corps.value + ab.agilite.value + att.level.value) / 3) + parseInt(att.armor.value) + (att.shield.value ? 2 : 0);

    att.actions.max      = 5;
    // Id att.actions.value id not set or not a number, set it to att.actions.max 
    if (isNaN(att.actions.value)) {
      att.actions.value = att.actions.max;
    }
    if (att.actions.value > att.actions.max) {
      att.actions.value = att.actions.max;
    }
    if(att.actions.value < 0) {
      att.actions.value = 0;
    }

    const radius = 27;
    const circumference = 2 * Math.PI * radius;
    att.actions.percents = circumference - (att.actions.value / 5) * circumference;
    systemData.pv.percents = circumference - (systemData.pv.value / systemData.pv.max) * circumference;

    // Derivated aptitudes
    aptitudes.melee.value       = Math.floor((ab.force.value        + ab.force.value    + att.level.value) / 3);
    aptitudes.tir.value         = Math.floor((ab.agilite.value      + ab.agilite.value  + att.level.value) / 3);
    aptitudes.furtivite.value   = Math.floor((ab.agilite.value      + ab.esprit.value   + att.level.value) / 3);
    aptitudes.esquive.value     = Math.floor((ab.agilite.value      + ab.corps.value    + att.level.value) / 3);
    aptitudes.perception.value  = Math.floor((ab.esprit.value       + ab.esprit.value   + att.level.value) / 3);
    aptitudes.savoir.value      = Math.floor((ab.esprit.value       + ab.charisme.value + att.level.value) / 3);
    aptitudes.social.value      = Math.floor((ab.charisme.value     + ab.charisme.value + att.level.value) / 3);
    aptitudes.magie.value       = Math.floor((ab.esprit.value       + ab.corps.value    + att.level.value) / 3);

    delete aptitudes.defense;
    delete systemData.pm;
    delete att.esquive;

  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
    systemData.xp = systemData.cr * systemData.cr * 100;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    // Starts off by populating the roll data with `this.system`
    const data = { ...super.getRollData() };

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== 'character') return;

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@force.mod + 4`.
    if (data.abilities) {
      for (let [k, v] of Object.entries(data.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    // Add level for easier access, or fall back to 0.
    if (data.attributes.level) {
      data.lvl = data.attributes.level.value ?? 0;
    }
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;

    // Process additional NPC data here.
  }
}
