// server/config/autoReplyState.js
// Per-conversation auto-reply state.

const fs = require('fs');
const path = require('path');
const storagePath = path.join(__dirname, '../../autoReplyData.json');

class AutoReplyState {
    constructor() {
        this.enabledConvs = new Set();
        this.excludedConvs = new Set(['123', 'admin']);
        this.lastReplied = new Map();
        this.autoMode = false;
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(storagePath)) {
                const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
                if (data.enabledConvs) this.enabledConvs = new Set(data.enabledConvs);
                if (data.lastReplied) this.lastReplied = new Map(Object.entries(data.lastReplied));
                if (data.autoMode !== undefined) this.autoMode = !!data.autoMode;
            }
        } catch (e) {
            console.error('[AutoReplyState] Error loading state:', e);
        }
    }

    save() {
        try {
            const data = {
                enabledConvs: Array.from(this.enabledConvs),
                lastReplied: Object.fromEntries(this.lastReplied),
                autoMode: this.autoMode
            };
            fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[AutoReplyState] Error saving state:', e);
        }
    }

    isEnabled(convID) {
        return this.enabledConvs.has(String(convID));
    }

    enable(convID) {
        this.enabledConvs.add(String(convID));
        this.save();
    }

    disable(convID) {
        this.enabledConvs.delete(String(convID));
        this.save();
    }

    toggle(convID) {
        const id = String(convID);
        if (this.enabledConvs.has(id)) {
            this.enabledConvs.delete(id);
        } else {
            this.enabledConvs.add(id);
        }
        this.save();
        return this.enabledConvs.has(id);
    }

    toggleAutoMode() {
        this.autoMode = !this.autoMode;
        this.save();
        return this.autoMode;
    }
}

module.exports = new AutoReplyState();
