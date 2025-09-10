package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;

@Entity
@Table(
    name = "program_category_requirement",
    uniqueConstraints = @UniqueConstraint(columnNames = {"program_id", "category_id"}),
    indexes = {
        @Index(name = "idx_pcr_program", columnList = "program_id"),
        @Index(name = "idx_pcr_category", columnList = "category_id"),
        @Index(name = "idx_pcr_program_category", columnList = "program_id, category_id")
    }
)
public class ProgramCategoryRequirement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @ManyToOne(optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Categories category;

    @Column(name = "min_courses", nullable = false)
    private Integer minCourses;

    @Column(name = "min_credits", nullable = false)
    private Double minCredits;

    // Default constructor
    public ProgramCategoryRequirement() {}

    // Parameterized constructor
    public ProgramCategoryRequirement(Program program, Categories category, Integer minCourses, Double minCredits) {
        this.program = program;
        this.category = category;
        this.minCourses = minCourses;
        this.minCredits = minCredits;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Program getProgram() {
        return program;
    }

    public void setProgram(Program program) {
        this.program = program;
    }

    public Categories getCategory() {
        return category;
    }

    public void setCategory(Categories category) {
        this.category = category;
    }

    public Integer getMinCourses() {
        return minCourses;
    }

    public void setMinCourses(Integer minCourses) {
        this.minCourses = minCourses;
    }

    public Double getMinCredits() {
        return minCredits;
    }

    public void setMinCredits(Double minCredits) {
        this.minCredits = minCredits;
    }

    @Override
    public String toString() {
        return "ProgramCategoryRequirement{" +
                "id=" + id +
                ", program=" + (program != null ? program.getCode() : null) +
                ", category=" + (category != null ? category.getCategoryName() : null) +
                ", minCourses=" + minCourses +
                ", minCredits=" + minCredits +
                '}';
    }
}
