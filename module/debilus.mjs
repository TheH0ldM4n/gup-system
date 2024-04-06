// Import document classes.
import { DebilusActor } from './documents/actor.mjs';
import { DebilusItem } from './documents/item.mjs';
// Import sheet classes.
import { DebilusActorSheet } from './sheets/actor-sheet.mjs';
import { DebilusItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { DEBILUS } from './helpers/config.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.debilus = {
    DebilusActor,
    DebilusItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.DEBILUS = DEBILUS;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    // 1d20 + agilite
    formula: '1d20 + @agilite.value',
    decimals: 0,
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = DebilusActor;
  CONFIG.Item.documentClass = DebilusItem;

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('debilus', DebilusActorSheet, {
    makeDefault: true,
    label: 'DEBILUS.SheetLabels.Actor',
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('debilus', DebilusItemSheet, {
    makeDefault: true,
    label: 'DEBILUS.SheetLabels.Item',
  });

  // Register system settings
  game.settings.register('debilus', 'setting', {
    name: 'DEBILUS.Settings.Labels.Setting',
    hint: 'DEBILUS.Settings.Hints.Setting',
    scope: 'world',
    config: true,
    restricted: true,
    requiresReload: true,
    type: String,
    choices: {
      fantasy: 'DEBILUS.Settings.Setting.Fantasy',
      starwars: 'DEBILUS.Settings.Setting.StarWars',
      scifi: 'DEBILUS.Settings.Setting.SciFi',
      modern: 'DEBILUS.Settings.Setting.Modern',
    },
    default: 'fantasy',
  });

  let gameSetting = game.settings.get('debilus', 'setting');
  document.body.classList.add(gameSetting);

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});


/* -------------------------------------------- */
/*  Combat Hooks                                */
/* -------------------------------------------- */

// // On combat start, reset all actors' actions to their max value & reset cooldowns

// On combat end, reset all actors' actions to their max value & reset cooldowns
Hooks.on("combatEnd", async (combat, options, userId) => {
  console.error("combatEnd");
  await resetActionsAndCooldowns();
});


Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  // DO only if the user is the GM
  if (game.user.isGM) {
    // Check if the change includes a new round starting, but not when round has decreased
    if (changed.hasOwnProperty("round") && combat.previous.round < combat.round) {
      // If first round, reset actions and cooldowns
      if (combat.round === 1) {
        await resetActionsAndCooldowns();
      } else {
        // Loop through all actors
        for (const actor of game.actors) {
          // Update cooldowns for all competences
          await updateCompetencesCooldowns(actor);
          // Check if the actions.max exists for this actor
          if (actor.system.attributes.actions?.max !== undefined) {
            // Set actions.value equal to actions.max
            await actor.update({"system.attributes.actions.value": actor.system.attributes.actions.max})
              .then(() => {
                // Refresh the actor's sheet, if it is open
                if (actor.sheet.rendered) {
                  actor.sheet.render(true);
                }
              });
          }
        }
      }
    }
  }
});

async function resetActionsAndCooldowns() {
  // Do nothing if the user is the GM
  if (game.user.isGM) {
    for (const actor of game.actors) {
      // Update cooldowns for all competences
      await resetCompetencesCooldowns(actor);
      // Check if the actions.max exists for this actor
      if (actor.system.attributes.actions?.max !== undefined) {
        // Set actions.value equal to actions.max
        await actor.update({
          "system.attributes.actions.value": actor.system.attributes.actions.max
        }).then(() => {
          // Refresh the actor's sheet, if it is open
          if (actor.sheet.rendered) {
            actor.sheet.render(true);
          }
        });
      }
    }
  }
}


async function updateCompetencesCooldowns(actor) {
  const competences = actor.items.filter((item) => item.type === "competence");
  for (const competence of competences) {
    const cooldown = competence.system.cooldown;
    if (cooldown.value > 0 && cooldown.remaining) {
      await competence.update({"system.cooldown.remaining": cooldown.remaining - 1});
    }
  }
}

async function resetCompetencesCooldowns(actor) {
  const competences = actor.items.filter((item) => item.type === "competence");
  for (const competence of competences) {
    await competence.update({"system.cooldown.remaining": 0});
  }
}

/* -------------------------------------------- */
/*  Token HUD Hook                              */
/* -------------------------------------------- */
Hooks.on('renderTokenHUD', (app, html, data) => {

  // Add reset actions counter button
  let resetActionsButton = $('<div class="control-icon"><i class="fas fa-redo" title="Réinitialiser les actions" color="teal"></i></div>');

  resetActionsButton.on('click', (event) => {
    const actor = game.actors.get(data.actorId);
    actor.update({"system.attributes.actions.value": actor.system.attributes.actions.max});
    // Send chat message
    ChatMessage.create({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: actor.name + " a réinitialisé ses actions."
    });
  });

  html.find('.middle').prepend(resetActionsButton);

  // If there is an active combat, add movement action button
  if (!game.combat) return;
  let newButton = $('<div class="control-icon"><i class="fas fa-person-walking" title="Consommer une action de déplacement"></i></div>');
  newButton.on('click', (event) => {
    const actor = game.actors.get(data.actorId);
    if(actor.system.attributes.actions.value > 0) {
      actor.update({"system.attributes.actions.value": actor.system.attributes.actions.value - 1});
      ChatMessage.create({
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: actor.name + " a consommé une action de déplacement."
      });
    } else {
      ui.notifications.error("Vous n'avez plus d'actions disponibles.");
    }
  });

  // Append your new button to the HUD. Adjust the selector as needed.
  html.find('.right').append(newButton);
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('equal', function(lvalue, rvalue, options) {
  if (arguments.length < 3)
      throw new Error("Handlebars Helper equal needs 2 parameters");
  if( lvalue!=rvalue ) {
      return options.inverse(this);
  } else {
      return options.fn(this);
  }
});

// Helper that converts every special character to its HTML entity
Handlebars.registerHelper('htmlEntities', function(str) {
  return str.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
    return '&#'+i.charCodeAt(0)+';';
  });
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
});

// socketlib
Hooks.once('socketlib.ready', () => {
  DEBILUS.socket = socketlib.registerSystem('debilus');
  DEBILUS.socket.register("sendSoundToPlayer", sendSoundToPlayer);
});

function sendSoundToPlayer(soundPath, targetUserId) {
  if( targetUserId === game.userId ) {
    AudioHelper.play({src: soundPath, volume: 0.8, autoplay: true, loop: false}, true);
  }
}

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.debilus.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'debilus.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}
