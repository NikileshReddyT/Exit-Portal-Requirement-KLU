package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;

import java.util.Objects;

@Entity
@Table(
    name = "categories",
    indexes = {
        @Index(name = "idx_categories_program", columnList = "program_id"),
        @Index(name = "idx_categories_name", columnList = "category_name"),
        @Index(name = "idx_categories_program_name", columnList = "program_id, category_name")
    }
)
public class Categories {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "category_id")
    private int categoryID;

    @ManyToOne
    @JoinColumn(name = "program_id", nullable = true)
    private Program program;

    @Column(name = "category_name", nullable = false)
    private String categoryName;


    public int getCategoryID() {
        return categoryID;
    }

    public void setCategoryID(int categoryID) {
        this.categoryID = categoryID;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }


    public Program getProgram() {
        return program;
    }

    public void setProgram(Program program) {
        this.program = program;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Categories that = (Categories) o;
        return categoryID == that.categoryID;
    }

    @Override
    public int hashCode() {
        return Objects.hash(categoryID);
    }
}
