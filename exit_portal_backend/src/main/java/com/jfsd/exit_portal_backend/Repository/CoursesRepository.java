package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.Courses;

import org.springframework.data.jpa.repository.JpaRepository;
// import org.springframework.data.jpa.repository.Query;
// import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CoursesRepository extends JpaRepository<Courses, Integer> {
    // Custom method to find the first course by code
    Optional<Courses> findFirstByCourseCode(String courseCode);
    
    // Bulk fetch by course codes to minimize round-trips during uploads
    List<Courses> findByCourseCodeIn(List<String> courseCodes);
    // Note: These methods need to be updated for 3NF model - courses are now mapped to categories via ProgramCourseCategory
    // For now, removing these incompatible queries
    // List<Courses> findByCategoryName(@Param("categoryName") String categoryName);
    // List<Courses> findAllByCategory(@Param("categoryName") String categoryName);

}
