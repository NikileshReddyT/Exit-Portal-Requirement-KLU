package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.AdminUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AdminUserRepository extends JpaRepository<AdminUser, Long> {
    Optional<AdminUser> findByUsername(String username);
    boolean existsByUsername(String username);
    long countByRole(AdminUser.Role role);
}
