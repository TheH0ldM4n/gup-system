export class ItemRoll {

    constructor(label, img, dice, mod, bonusMalus, critrange, description, noRoll, actions, value, valueType, rollType, type, valueBonus)
    {
        this._label = label;
        this._img = img;
        this._dice = dice;
        this._mod = mod;
        this._bonusMalus = bonusMalus;
        this._class = "";
        this._critrange = critrange;
        const bonusMalusString = (this._bonusMalus >= 0) ? `+${this._bonusMalus}` : this._bonusMalus;
        this._formula = ((this._bonusMalus === 0) ? `${this._dice} ${this._mod}` : `${this._dice} ${this._mod} ${bonusMalusString}`);
        this._isCritical = false;
        this._isFumble = false;
        this._isSuccess = false;
        this._description = Array.isArray(description) ? description.join("<br>") : description;
        this._noRoll = noRoll;
        this._actions = actions;
        this._value = value;
        this._valueType = valueType;
        this._rollType = rollType;
        this._type = type;
        this._valueBonus = valueBonus;
    }

    async roll(actor) {

        if (this._noRoll) {
            this._buildRollMessage(actor).then(msgFlavor => {
                ChatMessage.create({
                    user: game.user.id,
                    content: msgFlavor,
                    speaker: ChatMessage.getSpeaker({ actor: actor })
                });
            });
        } else {

            let r = new Roll(this._formula);
            await r.roll({ "async": true });
            // Getting the dice kept in case of 2d12 or 2d20 rolls
            const result = r.terms[0].results.find(r => r.active).result;
            this._isCritical = ((result >= this._critrange.split("-")[0]) || result == 20);
            this._isFumble = (result == 1);
            this._buildRollMessage(actor).then(msgFlavor => {
                r.toMessage({
                    user: game.user.id,
                    flavor: msgFlavor,
                    speaker: ChatMessage.getSpeaker({ actor: actor })
                });
            })

            return r;
        }
    }

    _buildRollMessage(actor) {
        const rollMessageTpl = 'systems/debilus/templates/chat/skill-roll-card.hbs';

        let value = this._value + this._valueBonus;

        if (this._isCritical) {
            this._class = "critical";
            value = value * 2;
        }

        if (this._isFumble) {
            this._class = "fumble";
            value = 0;
        }

        const hasValue = !!(this._valueType !== "none" && value);
        const hasActions = !!(this._actions && this._actions > 0);
        const hasRollType = !!(this._rollType && this._rollType !== null && this._rollType.length > 0);
        const hasDetails = !!(hasValue || hasActions || hasRollType);

        const tplData = {
            type: this._type,
            label: this._label,
            img: this._img,
            class: this._class,
            isCritical: this._isCritical,
            isFumble: this._isFumble,
            hasDescription: this._description && this._description.length > 0,
            description: this._description,
            actorName: actor.name,
            actorImg: actor.img,
            hasValue: hasValue,
            hasActions: hasActions,
            hasRollType: hasRollType,
            hasDetails: hasDetails,
            actions: this._actions,
            value: value,
            valueType: this._valueType,
            rollType: this._rollType,
        };
        return renderTemplate(rollMessageTpl, tplData);
    }
}