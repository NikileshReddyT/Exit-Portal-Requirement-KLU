package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.Program;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProgramRepository extends JpaRepository<Program, Long> {
    Optional<Program> findByCode(String code);
    boolean existsByCode(String code);
}
