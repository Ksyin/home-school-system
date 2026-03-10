/* =====================================================
   DATA API
   Central data access layer for the LMS
   ===================================================== */

window.DataAPI = {

  /* ---------------------------------------------
     GET CURRENT USER PROFILE
  --------------------------------------------- */
  async getCurrentProfile() {

    const user = await sb.auth.getUser()

    if (!user.data.user) return null

    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", user.data.user.id)
      .single()

    if (error) throw error

    return data
  },


  /* ---------------------------------------------
     GET ALL STUDENTS
     Tutors automatically see every student
  --------------------------------------------- */
  async getAllStudents() {

    const { data, error } = await sb
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        grade_level,
        created_at
      `)
      .eq("role", "student")
      .order("full_name", { ascending: true })

    if (error) throw error

    return data || []
  },


  /* ---------------------------------------------
     GET STUDENT HISTORY
     Students + tutors view past activities
  --------------------------------------------- */
  async getStudentHistory(studentId) {

    const { data, error } = await sb
      .from("submissions")
      .select(`
        id,
        submitted_at,
        grade,
        feedback,
        assignments(
          id,
          title,
          subject,
          due_date
        )
      `)
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false })

    if (error) throw error

    return data || []
  },


  /* ---------------------------------------------
     GET STUDENT ASSIGNMENTS
  --------------------------------------------- */
  async getStudentAssignments(studentId) {

    const { data, error } = await sb
      .from("assignments")
      .select(`
        id,
        title,
        subject,
        description,
        due_date,
        created_at
      `)
      .eq("student_id", studentId)
      .order("due_date", { ascending: true })

    if (error) throw error

    return data || []
  },


  /* ---------------------------------------------
     PARENT -> CHILDREN
  --------------------------------------------- */
  async getParentChildren(parentId) {

    const { data, error } = await sb
      .from("student_parent_links")
      .select(`
        student_id,
        profiles!student_parent_links_student_id_fkey(
          id,
          full_name,
          email,
          grade_level
        )
      `)
      .eq("parent_id", parentId)

    if (error) throw error

    return data || []
  },


  /* ---------------------------------------------
     PARENT REPORT
     Parents see children performance
  --------------------------------------------- */
  async getParentReport(parentId) {

    const children = await this.getParentChildren(parentId)

    const studentIds = children.map(c => c.student_id)

    if (!studentIds.length) return []

    const { data, error } = await sb
      .from("submissions")
      .select(`
        submitted_at,
        grade,
        feedback,
        assignments(title),
        profiles!submissions_student_id_fkey(full_name)
      `)
      .in("student_id", studentIds)
      .order("submitted_at", { ascending: false })

    if (error) throw error

    return data || []
  },


  /* ---------------------------------------------
     TUTOR REVIEW SUBMISSION
  --------------------------------------------- */
  async reviewSubmission(submissionId, grade, feedback, tutorId) {

    const { error } = await sb
      .from("submissions")
      .update({
        grade: grade,
        feedback: feedback,
        reviewed_by: tutorId,
        reviewed_at: new Date()
      })
      .eq("id", submissionId)

    if (error) throw error

    return true
  }

}