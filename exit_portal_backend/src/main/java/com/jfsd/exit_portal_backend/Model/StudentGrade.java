package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;

@Entity
@Table(
    name = "student_grades",
    indexes = {
        @Index(name = "idx_sg_university", columnList = "university_id"),
        @Index(name = "idx_sg_course", columnList = "course_id"),
        @Index(name = "idx_sg_university_category", columnList = "university_id, category"),
        @Index(name = "idx_sg_course_promotion", columnList = "course_id, promotion"),
        @Index(name = "idx_sg_university_promotion", columnList = "university_id, promotion"),
        @Index(name = "idx_sg_category", columnList = "category"),
        @Index(name = "idx_sg_promotion", columnList = "promotion"),
        @Index(name = "idx_sg_year_sem", columnList = "academic_year, semester")
    },
    uniqueConstraints = @UniqueConstraint(name = "uq_student_grades_uid_course", columnNames = {"university_id", "course_id"})
)
public class StudentGrade {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sno;
    
    // Use same column name 'university_id' but reference students.student_id
    @ManyToOne(optional = false)
    @JoinColumn(name = "university_id", referencedColumnName = "student_id")
    private Student student;
    
    @Transient
    private String courseCode;
    
    @Transient
    private String courseName;
    
    private String grade;
    
    @Column(name = "grade_point")
    private Double gradePoint;
    
    @Transient
    private Double credits;
    
    private String promotion;
    
    @Column(name = "category")
    private String category;
    
    @Column(name = "academic_year")
    private String year;
    
    @Column(name = "semester")
    private String semester;

    @ManyToOne
    @JoinColumn(name = "course_id", nullable = true)
    private Courses course;

    // Getters and Setters
    public Long getSno() { return sno; }
    public void setSno(Long sno) { this.sno = sno; }

    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    

    public String getCourseCode() {
        if (course != null) {
            return course.getCourseCode();
        }
        return courseCode;
    }
    public void setCourseCode(String courseCode) { this.courseCode = courseCode; }

    public String getCourseName() {
        if (course != null) {
            return course.getCourseTitle();
        }
        return courseName;
    }
    public void setCourseName(String courseName) { this.courseName = courseName; }

    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }

    public Double getGradePoint() { return gradePoint; }
    public void setGradePoint(Double gradePoint) { this.gradePoint = gradePoint; }

    public Double getCredits() {
        if (course != null) {
            return course.getCourseCredits();
        }
        return credits;
    }
    public void setCredits(Double credits) { this.credits = credits; }

    public String getPromotion() { return promotion; }
    public void setPromotion(String promotion) { this.promotion = promotion; }

    public String getCategory() {
        return category;
    }
    public void setCategory(String category) { this.category = category; }

    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }

    public String getSemester() { return semester; }
    public void setSemester(String semester) { this.semester = semester; }

    public Courses getCourse() { return course; }
    public void setCourse(Courses course) { this.course = course; }
}
