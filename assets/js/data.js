window.DataAPI = {
  async getParentChildren(parentId) {
    const { data, error } = await sb
      .from('student_parent_links')
      .select('student_id, profiles!student_parent_links_student_id_fkey(id, full_name, email, grade_level)')
      .eq('parent_id', parentId);
    if (error) throw error;
    return data || [];
  },
  async getTutorStudents(tutorId) {
    const { data, error } = await sb
      .from('classroom_members')
      .select('classroom_id, student_id, profiles!classroom_members_student_id_fkey(id, full_name, email, grade_level), classrooms(title)')
      .eq('tutor_id', tutorId);
    if (error) throw error;
    return data || [];
  },
  async getAssignmentsForRole(role, profileId) {
    if (role === 'student') {
      const { data, error } = await sb.from('assignments').select('*, profiles!assignments_created_by_fkey(full_name), classrooms(title)').or(`student_id.eq.${profileId},student_id.is.null`).order('due_date',{ascending:true});
      if (error) throw error; return data || [];
    }
    if (role === 'tutor') {
      const { data, error } = await sb.from('assignments').select('*, profiles!assignments_student_id_fkey(full_name), classrooms(title)').eq('created_by', profileId).order('created_at',{ascending:false});
      if (error) throw error; return data || [];
    }
    const childIds = (await this.getParentChildren(profileId)).map(r=>r.student_id);
    if (!childIds.length) return [];
    const { data, error } = await sb.from('assignments').select('*, profiles!assignments_student_id_fkey(full_name), classrooms(title)').in('student_id', childIds).order('due_date',{ascending:true});
    if (error) throw error; return data || [];
  },
  async getAssessmentsForRole(role, profileId) {
    if (role === 'student') {
      const { data, error } = await sb.from('assessments').select('*, subjects(name), profiles!assessments_created_by_fkey(full_name)').eq('student_id', profileId).order('assessment_date',{ascending:false});
      if (error) throw error; return data || [];
    }
    if (role === 'tutor') {
      const { data, error } = await sb.from('assessments').select('*, subjects(name), profiles!assessments_student_id_fkey(full_name)').eq('created_by', profileId).order('assessment_date',{ascending:false});
      if (error) throw error; return data || [];
    }
    const childIds = (await this.getParentChildren(profileId)).map(r=>r.student_id);
    if (!childIds.length) return [];
    const { data, error } = await sb.from('assessments').select('*, subjects(name), profiles!assessments_student_id_fkey(full_name)').in('student_id', childIds).order('assessment_date',{ascending:false});
    if (error) throw error; return data || [];
  },
  async getPortfolioForRole(role, profileId) {
    if (role === 'student') {
      const { data, error } = await sb.from('portfolio_entries').select('*, subjects(name), profiles!portfolio_entries_created_by_fkey(full_name)').eq('student_id', profileId).order('entry_date',{ascending:false});
      if (error) throw error; return data || [];
    }
    if (role === 'tutor') {
      const { data, error } = await sb.from('portfolio_entries').select('*, subjects(name), profiles!portfolio_entries_student_id_fkey(full_name)').eq('created_by', profileId).order('entry_date',{ascending:false});
      if (error) throw error; return data || [];
    }
    const childIds = (await this.getParentChildren(profileId)).map(r=>r.student_id);
    if (!childIds.length) return [];
    const { data, error } = await sb.from('portfolio_entries').select('*, subjects(name), profiles!portfolio_entries_student_id_fkey(full_name)').in('student_id', childIds).order('entry_date',{ascending:false});
    if (error) throw error; return data || [];
  },
  async getAttendanceForRole(role, profileId) {
    if (role === 'student') {
      const { data, error } = await sb.from('attendance_records').select('*, classrooms(title)').eq('student_id', profileId).order('record_date',{ascending:false});
      if (error) throw error; return data || [];
    }
    if (role === 'tutor') {
      const { data, error } = await sb.from('attendance_records').select('*, profiles!attendance_records_student_id_fkey(full_name), classrooms(title)').eq('created_by', profileId).order('record_date',{ascending:false});
      if (error) throw error; return data || [];
    }
    const childIds = (await this.getParentChildren(profileId)).map(r=>r.student_id);
    if (!childIds.length) return [];
    const { data, error } = await sb.from('attendance_records').select('*, profiles!attendance_records_student_id_fkey(full_name), classrooms(title)').in('student_id', childIds).order('record_date',{ascending:false});
    if (error) throw error; return data || [];
  },
  async getReportCardsForRole(role, profileId) {
    if (role === 'student') {
      const { data, error } = await sb.from('report_cards').select('*, profiles!report_cards_created_by_fkey(full_name)').eq('student_id', profileId).order('term_end',{ascending:false});
      if (error) throw error; return data || [];
    }
    if (role === 'tutor') {
      const { data, error } = await sb.from('report_cards').select('*, profiles!report_cards_student_id_fkey(full_name)').eq('created_by', profileId).order('term_end',{ascending:false});
      if (error) throw error; return data || [];
    }
    const childIds = (await this.getParentChildren(profileId)).map(r=>r.student_id);
    if (!childIds.length) return [];
    const { data, error } = await sb.from('report_cards').select('*, profiles!report_cards_student_id_fkey(full_name)').in('student_id', childIds).order('term_end',{ascending:false});
    if (error) throw error; return data || [];
  },
  async getResources(role, profileId) {
    let query = sb.from('resources').select('*, subjects(name), classrooms(title), profiles!resources_created_by_fkey(full_name)').order('created_at',{ascending:false});
    if (role==='tutor') query = query.eq('created_by', profileId);
    const { data, error } = await query; if (error) throw error; return data || [];
  },
  async getMessages(role, profileId) {
    const { data, error } = await sb.from('messages').select('*, sender:profiles!messages_sender_id_fkey(full_name), recipient:profiles!messages_recipient_id_fkey(full_name)').or(`sender_id.eq.${profileId},recipient_id.eq.${profileId}`).order('created_at',{ascending:false});
    if (error) throw error; return data || [];
  },
  async dashboardSummary(role, profileId) {
    const [assignments, assessments, attendance, portfolios] = await Promise.all([
      this.getAssignmentsForRole(role, profileId),
      this.getAssessmentsForRole(role, profileId),
      this.getAttendanceForRole(role, profileId),
      this.getPortfolioForRole(role, profileId)
    ]);
    return {
      assignments,
      assessments,
      attendance,
      portfolios,
      pendingAssignments: assignments.filter(a => !a.status || a.status !== 'completed').length,
      averageScore: assessments.length ? Math.round(assessments.reduce((s,a)=>s+(Number(a.score)||0),0)/assessments.length) : 0,
      presentDays: attendance.filter(a => a.status === 'present').length,
      portfolioCount: portfolios.length
    };
  }
};
