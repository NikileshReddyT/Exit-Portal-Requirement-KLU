package com.jfsd.exit_portal_backend.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import com.jfsd.exit_portal_backend.Model.StudentCredentials;

@Deprecated
@NoRepositoryBean
public interface StudentCredentialsRepository extends JpaRepository<StudentCredentials, Long> {
    Optional<StudentCredentials> findByStudentId(String studentId);


}
