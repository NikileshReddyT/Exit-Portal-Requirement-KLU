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

    // Return rows for a student ordered by category_id to keep category ordering stable
    @Query(value = "SELECT * FROM student_category_progress WHERE university_id = :universityId ORDER BY category_id",
           nativeQuery = true)
    List<StudentCategoryProgress> findByUniversityIdOrderByCategoryId(@Param("universityId") String universityId);

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
            "  c.category_id,\n" +
            "  st.program_id\n" +
            "FROM students st\n" +
            "JOIN categories c ON c.program_id = st.program_id\n" +
            "LEFT JOIN program_category_requirement pcr ON pcr.program_id = st.program_id AND pcr.category_id = c.category_id\n" +
            "LEFT JOIN (\n" +
            "  SELECT sg.university_id, pcc.category_id, COUNT(*) AS completed_courses, SUM(co.course_credits) AS completed_credits\n" +
            "  FROM student_grades sg\n" +
            "  JOIN courses co ON co.course_id = sg.course_id\n" +
            "  JOIN program_course_category pcc ON pcc.course_id = co.course_id\n" +
            "  JOIN students st2 ON st2.student_id = sg.university_id\n" +
            "  WHERE sg.university_id IN (:ids) AND sg.promotion = 'P' AND pcc.program_id = st2.program_id\n" +
            "  GROUP BY sg.university_id, pcc.category_id\n" +
            ") a ON a.university_id = st.student_id AND a.category_id = c.category_id\n" +
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

    // ===== Optimized Aggregates for Dashboard (avoid loading large entity lists) =====
    // Count students who have met ALL their category requirements within optional program scope.
    @Query(value = "SELECT COUNT(*) FROM (\n" +
            "  SELECT scp.university_id\n" +
            "  FROM student_category_progress scp\n" +
            "  WHERE (:programId IS NULL OR scp.program_id = :programId)\n" +
            "  GROUP BY scp.university_id\n" +
            "  HAVING SUM(\n" +
            "    CASE\n" +
            "      WHEN (COALESCE(scp.min_required_courses,0) > 0 AND COALESCE(scp.completed_courses,0) < scp.min_required_courses)\n" +
            "        OR (COALESCE(scp.min_required_credits,0) > 0 AND COALESCE(scp.completed_credits,0) < scp.min_required_credits)\n" +
            "      THEN 1 ELSE 0 END\n" +
            "  ) = 0\n" +
            ") t",
            nativeQuery = true)
    long countCompletedStudents(@Param("programId") Long programId);

    // Category-level aggregates: total rows, met count, and average credit completion ratio (capped at 1.0)
    @Query(value = "SELECT\n" +
            "  scp.category_name AS categoryName,\n" +
            "  COUNT(*) AS total,\n" +
            "  SUM(CASE WHEN ( (COALESCE(scp.min_required_courses,0) <= 0 OR COALESCE(scp.completed_courses,0) >= scp.min_required_courses)\n" +
            "              AND (COALESCE(scp.min_required_credits,0) <= 0 OR COALESCE(scp.completed_credits,0) >= scp.min_required_credits) )\n" +
            "      THEN 1 ELSE 0 END) AS met,\n" +
            "  AVG(\n" +
            "    CASE WHEN COALESCE(scp.min_required_credits,0) > 0 THEN\n" +
            "      LEAST(1.0, (COALESCE(scp.completed_credits,0) * 1.0) / NULLIF(scp.min_required_credits,0))\n" +
            "    ELSE 0.0 END\n" +
            "  ) AS avgCreditCompletion\n" +
            "FROM student_category_progress scp\n" +
            "WHERE (:programId IS NULL OR scp.program_id = :programId)\n" +
            "GROUP BY scp.category_name",
            nativeQuery = true)
    List<CategoryAggregate> aggregateByCategory(@Param("programId") Long programId);

    interface CategoryAggregate {
        String getCategoryName();
        long getTotal();
        long getMet();
        double getAvgCreditCompletion();
    }

    // Projected aggregates: metProjected assumes registered courses/credits pass
    interface CategoryAggregateProjected {
        String getCategoryName();
        long getTotal();
        long getMetActual();
        long getMetProjected();
    }

    @Query(value = "SELECT\n" +
            "  scp.category_name AS categoryName,\n" +
            "  COUNT(*) AS total,\n" +
            "  SUM(CASE WHEN ( (COALESCE(scp.min_required_courses,0) <= 0 OR COALESCE(scp.completed_courses,0) >= scp.min_required_courses)\n" +
            "                AND (COALESCE(scp.min_required_credits,0) <= 0 OR COALESCE(scp.completed_credits,0) >= scp.min_required_credits) )\n" +
            "      THEN 1 ELSE 0 END) AS metActual,\n" +
            "  SUM(CASE WHEN ( (COALESCE(scp.min_required_courses,0) <= 0 OR (COALESCE(scp.completed_courses,0) + COALESCE(reg.registered_courses,0)) >= scp.min_required_courses)\n" +
            "                AND (COALESCE(scp.min_required_credits,0) <= 0 OR (COALESCE(scp.completed_credits,0) + COALESCE(reg.registered_credits,0)) >= scp.min_required_credits) )\n" +
            "      THEN 1 ELSE 0 END) AS metProjected\n" +
            "FROM student_category_progress scp\n" +
            "LEFT JOIN (\n" +
            "  SELECT sg.university_id, pcc.category_id, COUNT(*) AS registered_courses, SUM(co.course_credits) AS registered_credits\n" +
            "  FROM student_grades sg\n" +
            "  JOIN courses co ON co.course_id = sg.course_id\n" +
            "  JOIN program_course_category pcc ON pcc.course_id = co.course_id\n" +
            "  JOIN students st2 ON st2.student_id = sg.university_id\n" +
            "  WHERE sg.promotion = 'R' AND (:programId IS NULL OR pcc.program_id = :programId)\n" +
            "  GROUP BY sg.university_id, pcc.category_id\n" +
            ") reg ON reg.university_id = scp.university_id AND reg.category_id = scp.category_id\n" +
            "WHERE (:programId IS NULL OR scp.program_id = :programId)\n" +
            "GROUP BY scp.category_name",
            nativeQuery = true)
    List<CategoryAggregateProjected> aggregateByCategoryProjected(@Param("programId") Long programId);

    // Students who met a given category (optionally scoped by program)
    @Query(value = "SELECT scp.university_id AS universityId, scp.student_name AS studentName\n" +
            "FROM student_category_progress scp\n" +
            "WHERE scp.category_name = :categoryName\n" +
            "  AND (:programId IS NULL OR scp.program_id = :programId)\n" +
            "  AND ( (COALESCE(scp.min_required_courses,0) <= 0 OR COALESCE(scp.completed_courses,0) >= scp.min_required_courses)\n" +
            "        AND (COALESCE(scp.min_required_credits,0) <= 0 OR COALESCE(scp.completed_credits,0) >= scp.min_required_credits) )\n" +
            "GROUP BY scp.university_id, scp.student_name",
            nativeQuery = true)
    List<MetProjection> findStudentsWhoMetCategory(@Param("programId") Long programId, @Param("categoryName") String categoryName);

    interface MetProjection {
        String getUniversityId();
        String getStudentName();
    }

    // Projection for completed students with only completed metrics
    interface CompletedDetailProjection {
        String getUniversityId();
        String getStudentName();
        Integer getCompletedCourses();
        Double getCompletedCredits();
    }

    @Query(value = "SELECT scp.university_id AS universityId, scp.student_name AS studentName,\n" +
            "       COALESCE(scp.completed_courses,0) AS completedCourses, COALESCE(scp.completed_credits,0) AS completedCredits\n" +
            "FROM student_category_progress scp\n" +
            "WHERE scp.category_name = :categoryName\n" +
            "  AND (:programId IS NULL OR scp.program_id = :programId)\n" +
            "  AND ( (COALESCE(scp.min_required_courses,0) <= 0 OR COALESCE(scp.completed_courses,0) >= scp.min_required_courses)\n" +
            "        AND (COALESCE(scp.min_required_credits,0) <= 0 OR COALESCE(scp.completed_credits,0) >= scp.min_required_credits) )\n" +
            "GROUP BY scp.university_id, scp.student_name, scp.completed_courses, scp.completed_credits",
            nativeQuery = true)
    List<CompletedDetailProjection> findCompletedDetails(@Param("programId") Long programId, @Param("categoryName") String categoryName);

    // Projection for category-level minimums
    interface CategoryMinProjection {
        Integer getMinRequiredCourses();
        Double getMinRequiredCredits();
    }

    @Query(value = "SELECT "+
            "  COALESCE(MAX(scp.min_required_courses), 0) AS minRequiredCourses,\n" +
            "  COALESCE(MAX(scp.min_required_credits), 0) AS minRequiredCredits\n" +
            "FROM student_category_progress scp\n" +
            "WHERE scp.category_name = :categoryName\n" +
            "  AND (:programId IS NULL OR scp.program_id = :programId)",
            nativeQuery = true)
    CategoryMinProjection findCategoryMinimums(@Param("programId") Long programId, @Param("categoryName") String categoryName);

    // Detailed projection for incomplete students with minimums, completed, and registered metrics
    interface IncompleteDetailProjection {
        String getUniversityId();
        String getStudentName();
        Integer getMinRequiredCourses();
        Double getMinRequiredCredits();
        Integer getCompletedCourses();
        Double getCompletedCredits();
        Integer getRegisteredCourses();
        Double getRegisteredCredits();
    }

    @Query(value = "SELECT "+
            "  scp.university_id AS universityId,\n" +
            "  scp.student_name AS studentName,\n" +
            "  COALESCE(scp.min_required_courses, 0) AS minRequiredCourses,\n" +
            "  COALESCE(scp.min_required_credits, 0) AS minRequiredCredits,\n" +
            "  COALESCE(scp.completed_courses, 0) AS completedCourses,\n" +
            "  COALESCE(scp.completed_credits, 0) AS completedCredits,\n" +
            "  COALESCE(reg.registered_courses, 0) AS registeredCourses,\n" +
            "  COALESCE(reg.registered_credits, 0) AS registeredCredits\n" +
            "FROM student_category_progress scp\n" +
            "LEFT JOIN (\n" +
            "  SELECT sg.university_id, pcc.category_id, COUNT(*) AS registered_courses, SUM(co.course_credits) AS registered_credits\n" +
            "  FROM student_grades sg\n" +
            "  JOIN courses co ON co.course_id = sg.course_id\n" +
            "  JOIN program_course_category pcc ON pcc.course_id = co.course_id\n" +
            "  JOIN students st2 ON st2.student_id = sg.university_id\n" +
            "  WHERE sg.promotion = 'R' AND pcc.program_id = st2.program_id\n" +
            "  GROUP BY sg.university_id, pcc.category_id\n" +
            ") reg ON reg.university_id = scp.university_id AND reg.category_id = scp.category_id\n" +
            "WHERE scp.category_name = :categoryName\n" +
            "  AND (:programId IS NULL OR scp.program_id = :programId)\n" +
            "  AND ( (COALESCE(scp.min_required_courses,0) > 0 AND COALESCE(scp.completed_courses,0) < scp.min_required_courses)\n" +
            "        OR (COALESCE(scp.min_required_credits,0) > 0 AND COALESCE(scp.completed_credits,0) < scp.min_required_credits) )\n" +
            "GROUP BY scp.university_id, scp.student_name, scp.min_required_courses, scp.min_required_credits, scp.completed_courses, scp.completed_credits, reg.registered_courses, reg.registered_credits",
            nativeQuery = true)
    List<IncompleteDetailProjection> findIncompleteDetails(@Param("programId") Long programId, @Param("categoryName") String categoryName);
    // Students who did NOT meet a given category (optionally scoped by program)
    @Query(value = "SELECT scp.university_id AS universityId, scp.student_name AS studentName\n" +
            "FROM student_category_progress scp\n" +
            "WHERE scp.category_name = :categoryName\n" +
            "  AND (:programId IS NULL OR scp.program_id = :programId)\n" +
            "  AND ( (COALESCE(scp.min_required_courses,0) > 0 AND COALESCE(scp.completed_courses,0) < scp.min_required_courses)\n" +
            "        OR (COALESCE(scp.min_required_credits,0) > 0 AND COALESCE(scp.completed_credits,0) < scp.min_required_credits) )\n" +
            "GROUP BY scp.university_id, scp.student_name",
            nativeQuery = true)
    List<MetProjection> findStudentsWhoNotMetCategory(@Param("programId") Long programId, @Param("categoryName") String categoryName);

    // Count students whose number of unmet categories equals a specific value (e.g., 1 for "close to completion")
    @Query(value = "SELECT COUNT(*) FROM (\n" +
            "  SELECT scp.university_id,\n" +
            "         SUM(CASE WHEN ( (COALESCE(scp.min_required_courses,0) <= 0 OR COALESCE(scp.completed_courses,0) >= scp.min_required_courses)\n" +
            "                       AND (COALESCE(scp.min_required_credits,0) <= 0 OR COALESCE(scp.completed_credits,0) >= scp.min_required_credits) )\n" +
            "                  THEN 0 ELSE 1 END) AS notMetCnt\n" +
            "  FROM student_category_progress scp\n" +
            "  WHERE (:programId IS NULL OR scp.program_id = :programId)\n" +
            "  GROUP BY scp.university_id\n" +
            ") t\n" +
            "WHERE t.notMetCnt = :k",
            nativeQuery = true)
    long countStudentsWithNotMetCategories(@Param("programId") Long programId, @Param("k") int k);

    // Count students whose number of unmet categories is at most K (<= K)
    @Query(value = "SELECT COUNT(*) FROM (\n" +
            "  SELECT scp.university_id,\n" +
            "         SUM(CASE WHEN ( (COALESCE(scp.min_required_courses,0) <= 0 OR COALESCE(scp.completed_courses,0) >= scp.min_required_courses)\n" +
            "                       AND (COALESCE(scp.min_required_credits,0) <= 0 OR COALESCE(scp.completed_credits,0) >= scp.min_required_credits) )\n" +
            "                  THEN 0 ELSE 1 END) AS notMetCnt\n" +
            "  FROM student_category_progress scp\n" +
            "  WHERE (:programId IS NULL OR scp.program_id = :programId)\n" +
            "  GROUP BY scp.university_id\n" +
            ") t\n" +
            "WHERE t.notMetCnt <= :k",
            nativeQuery = true)
    long countStudentsWithNotMetCategoriesAtMost(@Param("programId") Long programId, @Param("k") int k);
}