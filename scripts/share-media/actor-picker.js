import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for the GM to select a linked player-character actor and update its portrait
 * to an image shared in chat.
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class ActorPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string} */
  #imageUrl;

  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID, "chat-snap-actor-picker"],
    window: { title: "Set Actor Portrait" },
    position: { width: 320, height: "auto" },
    actions: {
      pickActor: ActorPickerApp.prototype._onPickActor,
    },
  };

  static PARTS = {
    list: { template: `modules/${MODULE_ID}/templates/actor-picker.hbs` },
  };

  /**
   * @param {string} imageUrl  The image URL to assign as the chosen actor's portrait.
   */
  constructor(imageUrl) {
    super({});
    this.#imageUrl = imageUrl;
  }

  /**
   * Collect all users who have a linked player-character actor.
   * @override
   * @param {object} _options
   * @returns {Promise<{actors: Array<{id: string, name: string, img: string, userName: string}>}>}
   */
  async _prepareContext(_options) {
    const actors = game.users.contents
      .filter(u => u.character)
      .map(u => ({
        id: u.character.id,
        name: u.character.name,
        img: u.character.img,
        userName: u.name,
      }));
    return { actors };
  }

  /**
   * Update the selected actor's portrait to the image URL and close the dialog.
   * Bound to the `pickActor` action on each actor entry button.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target  The button element carrying `data-actor-id`.
   * @returns {Promise<void>}
   */
  async _onPickActor(_event, target) {
    const actor = game.actors.get(target.dataset.actorId);
    if (!actor) return;
    await actor.update({ img: this.#imageUrl });
    ui.notifications.info(`Chat Snap: Portrait updated for ${actor.name}.`);
    this.close();
  }
}
