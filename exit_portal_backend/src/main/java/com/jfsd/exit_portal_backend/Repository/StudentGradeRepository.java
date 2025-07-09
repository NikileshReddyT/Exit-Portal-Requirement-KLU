package com.jfsd.exit_portal_backend.Repository;

import java.util.List;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.jfsd.exit_portal_backend.Model.StudentGrade;

public interface StudentGradeRepository extends JpaRepository<StudentGrade, Long> {
    List<StudentGrade> findByUniversityId(String universityId);
    List<StudentGrade> findByUniversityIdAndCategory(String universityId, String category);
    boolean existsByUniversityIdAndCourseCode(String universityId, String courseCode);
    java.util.Optional<StudentGrade> findByUniversityIdAndCourseCode(String universityId, String courseCode);

    @Query("SELECT DISTINCT s.universityId FROM StudentGrade s")
    List<String> findAllUniqueStudentIds();

    List<StudentGrade> findByUniversityIdIn(Set<String> universityIds);
}