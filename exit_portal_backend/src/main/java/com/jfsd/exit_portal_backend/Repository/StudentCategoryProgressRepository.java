package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.RequestBodies.StudentCategoryProgressDTO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StudentCategoryProgressRepository extends JpaRepository<StudentCategoryProgress, Long> {
    List<StudentCategoryProgress> findByUniversityId(String universityId);
    void deleteByUniversityId(String universityId);
    StudentCategoryProgress findFirstByUniversityId(String universityId);

    @Query("SELECT new com.jfsd.exit_portal_backend.RequestBodies.StudentCategoryProgressDTO(" +
           "   scp.categoryName, " +
           "   scp.minRequiredCourses, " +
           "   scp.minRequiredCredits, " +
           "   COUNT(sg.id), " +
           "   SUM(sg.credits), " +
           "   SUM(CASE WHEN sg.grade IS NOT NULL AND sg.grade <> 'F' THEN 1 ELSE 0 END), " +
           "   SUM(CASE WHEN sg.grade IS NOT NULL AND sg.grade <> 'F' THEN sg.credits ELSE 0.0 END)) " +
           "FROM StudentCategoryProgress scp LEFT JOIN StudentGrade sg " +
           "   ON scp.universityId = sg.universityId AND scp.categoryName = sg.category " +
           "WHERE scp.universityId = :universityId " +
           "GROUP BY scp.categoryName, scp.minRequiredCourses, scp.minRequiredCredits, scp.studentName, scp.universityId")
    List<StudentCategoryProgressDTO> findStudentProgressSummary(@Param("universityId") String universityId);
}