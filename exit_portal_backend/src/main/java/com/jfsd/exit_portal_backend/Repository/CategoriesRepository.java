package com.jfsd.exit_portal_backend.Repository;

import com.jfsd.exit_portal_backend.Model.Categories;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoriesRepository extends JpaRepository<Categories, Integer> {

    @Query("SELECT c FROM Categories c WHERE LOWER(TRIM(c.categoryName)) = LOWER(TRIM(:name))")
    java.util.Optional<Categories> findByCategoryNameIgnoreCase(@Param("name") String name);

}