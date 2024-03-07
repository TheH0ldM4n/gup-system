/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/debilus/templates/actor/parts/actor-aptitudes.hbs',
    'systems/debilus/templates/actor/parts/actor-items.hbs',
    'systems/debilus/templates/actor/parts/actor-competences.hbs',
    'systems/debilus/templates/actor/parts/actor-effects.hbs',
    // Item partials
    'systems/debilus/templates/item/parts/item-effects.hbs',
  ]);
};
