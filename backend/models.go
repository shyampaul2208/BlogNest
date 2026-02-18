package main

import (
	"time"
)

type User struct {
	ID        string `json:"id" gorm:"primaryKey"`
	GoogleID  string `json:"google_id" gorm:"index"`
	Email     string `json:"email" gorm:"uniqueIndex"`
	Name      string `json:"name"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Picture   string `json:"picture"`
	Password  string `json:"-"` // Not returned in JSON
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Post struct {
	ID        string `json:"id" gorm:"primaryKey"`
	UserID    string `json:"user_id"`
	User      User   `json:"user" gorm:"foreignKey:UserID"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	ImageURL  string `json:"image_url"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Comment struct {
	ID        string `json:"id" gorm:"primaryKey"`
	PostID    string `json:"post_id"`
	UserID    string `json:"user_id"`
	User      User   `json:"user" gorm:"foreignKey:UserID"`
	Content   string `json:"content"`
	CreatedAt time.Time
}

type Like struct {
	ID     string `json:"id" gorm:"primaryKey"`
	PostID string `json:"post_id"`
	UserID string `json:"user_id"`
	User   User   `json:"user" gorm:"foreignKey:UserID"`
}
