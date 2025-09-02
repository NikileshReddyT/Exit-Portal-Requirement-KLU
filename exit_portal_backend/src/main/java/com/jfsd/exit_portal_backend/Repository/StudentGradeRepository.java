package com.jfsd.exit_portal_backend.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.jfsd.exit_portal_backend.Model.StudentGrade;

public interface StudentGradeRepository extends JpaRepository<StudentGrade, Long> {
    List<StudentGrade> findByStudent_StudentId(String studentId);
    
    // Eagerly load course to avoid N+1 when accessing grade.course
    @Query("SELECT s FROM StudentGrade s JOIN FETCH s.course WHERE s.student.studentId = :studentId")
    List<StudentGrade> findWithCourseByStudentId(@Param("studentId") String studentId);
    
    // Note: Updated to use category field directly from StudentGrade since courses no longer have category relationship in 3NF model
    @Query("SELECT s FROM StudentGrade s WHERE s.student.studentId = :studentId AND s.category = :category")
    List<StudentGrade> findByStudentIdAndCategory(@Param("studentId") String studentId, @Param("category") String category);

    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN TRUE ELSE FALSE END FROM StudentGrade s WHERE s.student.studentId = :studentId AND s.course.courseCode = :courseCode")
    boolean existsByStudentIdAndCourseCode(@Param("studentId") String studentId, @Param("courseCode") String courseCode);

    @Query("SELECT s FROM StudentGrade s WHERE s.student.studentId = :studentId AND s.course.courseCode = :courseCode")
    java.util.Optional<StudentGrade> findByStudentIdAndCourseCode(@Param("studentId") String studentId, @Param("courseCode") String courseCode);

    @Query("SELECT DISTINCT sg.student.studentId FROM StudentGrade sg")
    List<String> findAllUniqueStudentIds();

    @Query("SELECT DISTINCT sg.student.studentId FROM StudentGrade sg JOIN sg.student s JOIN s.program p WHERE p.code = :programCode")
    List<String> findStudentIdsByProgramCode(@Param("programCode") String programCode);

    List<StudentGrade> findByStudent_StudentIdIn(Set<String> studentIds);

    // Pageable queries for fast, paginated listings
    Page<StudentGrade> findAll(Pageable pageable);

    Page<StudentGrade> findByStudent_Program_ProgramId(Long programId, Pageable pageable);

    Page<StudentGrade> findByStudent_StudentId(String studentId, Pageable pageable);

    Page<StudentGrade> findByStudent_Program_ProgramIdAndStudent_StudentId(Long programId, String studentId, Pageable pageable);

    // Paged query for grades filtered by student and category
    Page<StudentGrade> findByStudent_StudentIdAndCategory(String studentId, String category, Pageable pageable);

    // Course completers (students with promotion 'P')
    List<StudentGrade> findByCourse_CourseCodeAndPromotionIgnoreCase(String courseCode, String promotion);

    // Course completers scoped by program
    List<StudentGrade> findByCourse_CourseCodeAndPromotionIgnoreCaseAndStudent_Program_ProgramId(String courseCode, String promotion, Long programId);
 
    // ===== Aggregations for course grade distribution =====
    @Query("SELECT COALESCE(UPPER(sg.grade),'NA') AS g, COUNT(sg) AS cnt " +
           "FROM StudentGrade sg JOIN sg.course c " +
           "WHERE LOWER(c.courseCode) = LOWER(:courseCode) " +
           "GROUP BY COALESCE(UPPER(sg.grade),'NA')")
    List<Object[]> countGradesByCourse(@Param("courseCode") String courseCode);

    @Query("SELECT COALESCE(UPPER(sg.grade),'NA') AS g, COUNT(sg) AS cnt " +
           "FROM StudentGrade sg JOIN sg.course c JOIN sg.student s JOIN s.program p " +
           "WHERE LOWER(c.courseCode) = LOWER(:courseCode) AND p.programId = :programId " +
           "GROUP BY COALESCE(UPPER(sg.grade),'NA')")
    List<Object[]> countGradesByCourseAndProgram(@Param("courseCode") String courseCode, @Param("programId") Long programId);

    @Query("SELECT COALESCE(UPPER(sg.promotion),'NA') AS pr, COUNT(sg) AS cnt " +
           "FROM StudentGrade sg JOIN sg.course c " +
           "WHERE LOWER(c.courseCode) = LOWER(:courseCode) " +
           "GROUP BY COALESCE(UPPER(sg.promotion),'NA')")
    List<Object[]> countPromotionsByCourse(@Param("courseCode") String courseCode);

    @Query("SELECT COALESCE(UPPER(sg.promotion),'NA') AS pr, COUNT(sg) AS cnt " +
           "FROM StudentGrade sg JOIN sg.course c JOIN sg.student s JOIN s.program p " +
           "WHERE LOWER(c.courseCode) = LOWER(:courseCode) AND p.programId = :programId " +
           "GROUP BY COALESCE(UPPER(sg.promotion),'NA')")
    List<Object[]> countPromotionsByCourseAndProgram(@Param("courseCode") String courseCode, @Param("programId") Long programId);

    @Query("SELECT COUNT(DISTINCT sg.student.studentId) FROM StudentGrade sg JOIN sg.course c WHERE LOWER(c.courseCode) = LOWER(:courseCode)")
    long countDistinctStudentsByCourse(@Param("courseCode") String courseCode);

    @Query("SELECT COUNT(DISTINCT sg.student.studentId) FROM StudentGrade sg JOIN sg.course c JOIN sg.student s JOIN s.program p WHERE LOWER(c.courseCode) = LOWER(:courseCode) AND p.programId = :programId")
    long countDistinctStudentsByCourseAndProgram(@Param("courseCode") String courseCode, @Param("programId") Long programId);

    // ===== Term-wise promotion counts (for trend charts) =====
    @Query("SELECT COALESCE(sg.year,'NA') AS yr, COALESCE(sg.semester,'NA') AS sem,\n" +
           "       SUM(CASE WHEN UPPER(COALESCE(sg.promotion,'NA')) = 'P' THEN 1 ELSE 0 END) AS passCnt,\n" +
           "       COUNT(sg) AS totalCnt\n" +
           "FROM StudentGrade sg\n" +
           "GROUP BY COALESCE(sg.year,'NA'), COALESCE(sg.semester,'NA')")
    List<Object[]> countPromotionsByTerm();

    @Query("SELECT COALESCE(sg.year,'NA') AS yr, COALESCE(sg.semester,'NA') AS sem,\n" +
           "       SUM(CASE WHEN UPPER(COALESCE(sg.promotion,'NA')) = 'P' THEN 1 ELSE 0 END) AS passCnt,\n" +
           "       COUNT(sg) AS totalCnt\n" +
           "FROM StudentGrade sg JOIN sg.student s JOIN s.program p\n" +
           "WHERE p.programId = :programId\n" +
           "GROUP BY COALESCE(sg.year,'NA'), COALESCE(sg.semester,'NA')")
    List<Object[]> countPromotionsByTermAndProgram(@Param("programId") Long programId);

    // ===== Course-level pass rates =====
    @Query("SELECT LOWER(c.courseCode) AS code,\n" +
           "       SUM(CASE WHEN UPPER(COALESCE(sg.promotion,'NA')) = 'P' THEN 1 ELSE 0 END) AS passCnt,\n" +
           "       COUNT(sg) AS totalCnt\n" +
           "FROM StudentGrade sg JOIN sg.course c\n" +
           "GROUP BY LOWER(c.courseCode)")
    List<Object[]> aggregateCoursePassRates();

    @Query("SELECT LOWER(c.courseCode) AS code,\n" +
           "       SUM(CASE WHEN UPPER(COALESCE(sg.promotion,'NA')) = 'P' THEN 1 ELSE 0 END) AS passCnt,\n" +
           "       COUNT(sg) AS totalCnt\n" +
           "FROM StudentGrade sg JOIN sg.course c JOIN sg.student s JOIN s.program p\n" +
           "WHERE p.programId = :programId\n" +
           "GROUP BY LOWER(c.courseCode)")
    List<Object[]> aggregateCoursePassRatesByProgram(@Param("programId") Long programId);

    // ===== Distinct student counts with any non-pass promotions (risk indicator) =====
    @Query("SELECT COUNT(DISTINCT sg.student.studentId) FROM StudentGrade sg WHERE UPPER(COALESCE(sg.promotion,'NA')) <> 'P'")
    long countDistinctStudentsWithAnyNonPass();

    @Query("SELECT COUNT(DISTINCT sg.student.studentId) FROM StudentGrade sg JOIN sg.student s JOIN s.program p WHERE UPPER(COALESCE(sg.promotion,'NA')) <> 'P' AND p.programId = :programId")
    long countDistinctStudentsWithAnyNonPassByProgram(@Param("programId") Long programId);

    // ===== Latest term (data freshness hint) =====
    @Query("SELECT MAX(COALESCE(sg.year,'NA')), MAX(COALESCE(sg.semester,'NA')) FROM StudentGrade sg")
    Object[] findMaxYearAndSemester();

    @Query("SELECT MAX(COALESCE(sg.year,'NA')), MAX(COALESCE(sg.semester,'NA')) FROM StudentGrade sg JOIN sg.student s JOIN s.program p WHERE p.programId = :programId")
    Object[] findMaxYearAndSemesterByProgram(@Param("programId") Long programId);
}