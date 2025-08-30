package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.Categories;
import com.jfsd.exit_portal_backend.Model.Program;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoriesRepository extends JpaRepository<Categories, Integer> {

    @Query("SELECT c FROM Categories c WHERE LOWER(TRIM(c.categoryName)) = LOWER(TRIM(:name))")
    Optional<Categories> findByCategoryNameIgnoreCase(@Param("name") String name);

    Optional<Categories> findByProgramAndCategoryName(Program program, String categoryName);

    // List categories for a program (3NF-friendly)
    List<Categories> findByProgram(Program program);

}