package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.ProgramCategoryRequirement;
import com.jfsd.exit_portal_backend.Model.Program;
import com.jfsd.exit_portal_backend.Model.Categories;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface ProgramCategoryRequirementRepository extends JpaRepository<ProgramCategoryRequirement, Long> {
    Optional<ProgramCategoryRequirement> findByProgramAndCategory(Program program, Categories category);
    
    @Query("SELECT pcr FROM ProgramCategoryRequirement pcr WHERE pcr.program.code = :programCode AND pcr.category.categoryName = :categoryName")
    Optional<ProgramCategoryRequirement> findByProgramCodeAndCategoryName(@Param("programCode") String programCode, @Param("categoryName") String categoryName);
    
    List<ProgramCategoryRequirement> findByProgram(Program program);
    
    @Query("SELECT pcr FROM ProgramCategoryRequirement pcr WHERE pcr.program.code = :programCode")
    List<ProgramCategoryRequirement> findByProgramCode(@Param("programCode") String programCode);

    @Query("SELECT pcr FROM ProgramCategoryRequirement pcr WHERE pcr.program.id = :programId AND pcr.honorsMinCredits IS NOT NULL")
    List<ProgramCategoryRequirement> findHonorsRequirementsByProgramId(@Param("programId") Long programId);

    List<ProgramCategoryRequirement> findByProgram_ProgramId(Long programId);

    List<ProgramCategoryRequirement> findByHonorsMinCreditsIsNotNull();
}
