package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.PasswordResetToken;
import com.jfsd.exit_portal_backend.Model.StudentCredentials;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    PasswordResetToken findByToken(String token);
    PasswordResetToken findByStudent(StudentCredentials student);

}
