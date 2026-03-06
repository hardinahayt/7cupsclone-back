// server/config/identity.js
/**
 * Global identity trackers for proxying Socket events.
 * Extracted from the proxy response to be injected into outbound socket actions.
 */
module.exports = {
    proxyScreenName: '',
    proxyUserTypeID: '',
    proxyMeToken: '',

    // Helper to update from Proxy
    updateIdentity(updates) {
        if (updates.proxyScreenName) this.proxyScreenName = updates.proxyScreenName;
        if (updates.proxyUserTypeID) this.proxyUserTypeID = updates.proxyUserTypeID;
        if (updates.proxyMeToken) this.proxyMeToken = updates.proxyMeToken;
    }
};
