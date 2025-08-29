package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.ProgramCourseCategory;
import com.jfsd.exit_portal_backend.Model.Program;
import com.jfsd.exit_portal_backend.Model.Courses;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface ProgramCourseCategoryRepository extends JpaRepository<ProgramCourseCategory, Long> {
    Optional<ProgramCourseCategory> findByProgramAndCourse(Program program, Courses course);
    
    @Query("SELECT pcc FROM ProgramCourseCategory pcc WHERE pcc.program.code = :programCode AND pcc.course.courseCode = :courseCode")
    Optional<ProgramCourseCategory> findByProgramCodeAndCourseCode(@Param("programCode") String programCode, @Param("courseCode") String courseCode);
    
    List<ProgramCourseCategory> findByProgram(Program program);
    
    @Query("SELECT pcc FROM ProgramCourseCategory pcc WHERE pcc.program.code = :programCode")
    List<ProgramCourseCategory> findByProgramCode(@Param("programCode") String programCode);

    // 3NF-friendly lookup: all mappings whose category name matches (case-insensitive)
    @Query("SELECT pcc FROM ProgramCourseCategory pcc WHERE LOWER(TRIM(pcc.category.categoryName)) = LOWER(TRIM(:categoryName))")
    List<ProgramCourseCategory> findByCategoryName(@Param("categoryName") String categoryName);

    // Program-scoped category lookup for accurate suggestions
    @Query("SELECT pcc FROM ProgramCourseCategory pcc WHERE pcc.program.programId = :programId AND LOWER(TRIM(pcc.category.categoryName)) = LOWER(TRIM(:categoryName))")
    List<ProgramCourseCategory> findByProgramIdAndCategoryName(@Param("programId") Long programId, @Param("categoryName") String categoryName);

    // Eagerly load course and category for all mappings of a program in one query
    @Query("SELECT pcc FROM ProgramCourseCategory pcc JOIN FETCH pcc.course c JOIN FETCH pcc.category cat WHERE pcc.program.programId = :programId")
    List<ProgramCourseCategory> findByProgramIdWithCourseAndCategory(@Param("programId") Long programId);
}
