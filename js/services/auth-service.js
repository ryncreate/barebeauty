// =====================================================================
// BARE BEAUTY INVENTORY MANAGEMENT SYSTEM (IMS)
// Supabase Authentication Service
// =====================================================================

window.BareBeauty = window.BareBeauty || {};
BareBeauty.services = BareBeauty.services || {};

BareBeauty.services.auth = {
  async signIn(email, password) {
    const sb = BareBeauty.supabase.client;
    if (!sb) throw new Error("Supabase is not connected.");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    // Require an explicitly provisioned administrator profile.
    try {
      await this.requireAdmin(data.user);
    } catch (error) {
      await sb.auth.signOut();
      throw error;
    }

    return data.user;
  },

  async requireAdmin(user) {
    const sb = BareBeauty.supabase.client;
    if (!sb || !user) throw new Error("Sign in is required.");
    const { data: profile, error } = await sb.from("profiles")
      .select("full_name, role").eq("id", user.id).single();
    if (error || !profile || profile.role !== "Inventory admin") {
      throw new Error("This account is not authorized as an inventory administrator.");
    }
    BareBeauty.config.ADMIN.name = profile.full_name || "Inventory admin";
    BareBeauty.config.ADMIN.role = profile.role;
    const nameEl = $("#userDisplayName");
    const roleEl = $("#userRoleName");
    if (nameEl) nameEl.textContent = BareBeauty.config.ADMIN.name;
    if (roleEl) roleEl.textContent = BareBeauty.config.ADMIN.role;
    return profile;
  },

  async signOut() {
    const sb = BareBeauty.supabase.client;
    if (!sb) return;
    await sb.auth.signOut();
  },

  async getSession() {
    const sb = BareBeauty.supabase.client;
    if (!sb) return null;
    const { data: { session: currentSession } } = await sb.auth.getSession();
    return currentSession;
  },
};
