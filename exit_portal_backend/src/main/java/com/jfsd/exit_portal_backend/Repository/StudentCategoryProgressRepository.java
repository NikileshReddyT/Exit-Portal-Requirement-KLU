package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Set;

@Repository
public interface StudentCategoryProgressRepository extends JpaRepository<StudentCategoryProgress, Long> {
    List<StudentCategoryProgress> findByUniversityId(String universityId);
    void deleteByUniversityId(String universityId);
    StudentCategoryProgress findFirstByUniversityId(String universityId);

    // Bulk delete for a set of students (massively reduces round-trips)
    @Modifying
    @Query("DELETE FROM StudentCategoryProgress scp WHERE scp.universityId IN :ids")
    void deleteByUniversityIdIn(@Param("ids") Set<String> universityIds);

    // Bulk recompute using a single INSERT ... SELECT with aggregation and joins
    // Now program-aware: only compute progress for students and categories within the same program
    // Uses new 3NF model with ProgramCourseCategory for course-to-category mapping
    @Modifying(clearAutomatically = true)
    @Query(value = "INSERT INTO student_category_progress (\n" +
            "  university_id, student_name, category_name,\n" +
            "  min_required_courses, min_required_credits,\n" +
            "  completed_courses, completed_credits, category_id, program_id\n" +
            ")\n" +
            "SELECT\n" +
            "  st.student_id AS university_id,\n" +
            "  st.student_name,\n" +
            "  c.category_name AS category_name,\n" +
            "  COALESCE(pcr.min_courses, 0) AS min_required_courses,\n" +
            "  COALESCE(pcr.min_credits, 0) AS min_required_credits,\n" +
            "  COALESCE(a.completed_courses, 0)  AS completed_courses,\n" +
            "  COALESCE(a.completed_credits, 0) AS completed_credits,\n" +
            "  c.categoryID,\n" +
            "  st.program_id\n" +
            "FROM students st\n" +
            "JOIN categories c ON c.program_id = st.program_id\n" +
            "LEFT JOIN program_category_requirement pcr ON pcr.program_id = st.program_id AND pcr.category_id = c.categoryID\n" +
            "LEFT JOIN (\n" +
            "  SELECT sg.university_id, pcc.category_id, COUNT(*) AS completed_courses, SUM(co.course_credits) AS completed_credits\n" +
            "  FROM student_grades sg\n" +
            "  JOIN courses co ON co.courseid = sg.course_id\n" +
            "  JOIN program_course_category pcc ON pcc.course_id = co.courseid\n" +
            "  JOIN students st2 ON st2.student_id = sg.university_id\n" +
            "  WHERE sg.university_id IN (:ids) AND sg.promotion = 'P' AND pcc.program_id = st2.program_id\n" +
            "  GROUP BY sg.university_id, pcc.category_id\n" +
            ") a ON a.university_id = st.student_id AND a.category_id = c.categoryID\n" +
            "WHERE st.student_id IN (:ids) AND st.program_id IS NOT NULL",
            nativeQuery = true)
    void insertProgressForUniversityIds(@Param("ids") Set<String> universityIds);

    // Note: Removed findStudentProgressSummary as it's incompatible with new 3NF model
    // Min requirements are now in ProgramCategoryRequirement and should be joined separately

    // Program-aware query methods
    @Query("SELECT scp FROM StudentCategoryProgress scp WHERE scp.universityId = :universityId AND scp.program.code = :programCode")
    List<StudentCategoryProgress> findByUniversityIdAndProgramCode(@Param("universityId") String universityId, @Param("programCode") String programCode);

    @Query("SELECT scp FROM StudentCategoryProgress scp WHERE scp.program.code = :programCode")
    List<StudentCategoryProgress> findByProgramCode(@Param("programCode") String programCode);
}