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
}