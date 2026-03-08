window.Auth = {
  async ensureConfig() {
    if (window.__supabaseConfigMissing || !window.sb) {
      UI.toast('Add your Supabase URL and anon key in assets/js/config.js', 'error');
      throw new Error('Supabase config missing');
    }
  },
  async currentUser() {
    await this.ensureConfig();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user;
  },
  async currentProfile() {
    const user = await this.currentUser();
    if (!user) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    return { user, profile: data };
  },
  async requireAuth(role) {
    const bundle = await this.currentProfile();
    if (!bundle?.user) {
      window.location.href = '/login.html';
      return null;
    }
    if (role && bundle.profile.role !== role) {
      const map = { parent:'/parent/dashboard.html', tutor:'/tutor/dashboard.html', student:'/student/dashboard.html' };
      window.location.href = map[bundle.profile.role] || '/login.html';
      return null;
    }
    return bundle;
  },
  async signIn(email, password) {
    await this.ensureConfig();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signUp({ name, email, password, role }) {
    await this.ensureConfig();
    const redirectTo = window.location.origin + '/login.html';
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, role }, emailRedirectTo: redirectTo }
    });
    if (error) throw error;
    return data;
  },
  async signOut() {
    await this.ensureConfig();
    await sb.auth.signOut();
    window.location.href = '/login.html';
  }
};
