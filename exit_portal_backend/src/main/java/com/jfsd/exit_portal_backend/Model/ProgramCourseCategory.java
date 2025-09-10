package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;

@Entity
@Table(
    name = "program_course_category",
    uniqueConstraints = @UniqueConstraint(columnNames = {"program_id", "course_id"}),
    indexes = {
        @Index(name = "idx_pcc_program", columnList = "program_id"),
        @Index(name = "idx_pcc_course", columnList = "course_id"),
        @Index(name = "idx_pcc_category", columnList = "category_id"),
        @Index(name = "idx_pcc_program_category", columnList = "program_id, category_id")
    }
)
public class ProgramCourseCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @ManyToOne(optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Courses course;

    @ManyToOne(optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Categories category;

    // Default constructor
    public ProgramCourseCategory() {}

    // Parameterized constructor
    public ProgramCourseCategory(Program program, Courses course, Categories category) {
        this.program = program;
        this.course = course;
        this.category = category;
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

    public Courses getCourse() {
        return course;
    }

    public void setCourse(Courses course) {
        this.course = course;
    }

    public Categories getCategory() {
        return category;
    }

    public void setCategory(Categories category) {
        this.category = category;
    }

    @Override
    public String toString() {
        return "ProgramCourseCategory{" +
                "id=" + id +
                ", program=" + (program != null ? program.getCode() : null) +
                ", course=" + (course != null ? course.getCourseCode() : null) +
                ", category=" + (category != null ? category.getCategoryName() : null) +
                '}';
    }
}
