package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudentRepository extends JpaRepository<Student, String> {
    Optional<Student> findByStudentId(String studentId);
    List<Student> findAllByStudentIdIn(Collection<String> studentIds);
}
