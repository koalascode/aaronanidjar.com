---

title: Improving Speeds on a Go Server
slug: goserverperformance
coverimg: https://aaronanidjar.s3.amazonaws.com/goserverthumbnail.jpg
excerpt: A few days ago I decided to try and build a web server in Go, here is how I improved performance on one route from 4 seconds to 250ms.
date: January 21, 2023

datemade: 1-21-2023
 
---

For the last 7 months, I have been working on a web app called [Yeaow](https://www.yeaow.com/), designed to connect content creators and video editors. I built the app with Next.js using TypeScript for the front and back end of the site.

Recently, I started watching more of tech YT, with two of my favorite creators being Theo - [t3.gg](http://t3.gg) and The Primeagen. Their discussions surrounding TypeScript and it’s usage have been very interesting to me. The two frequently bring up both Go and Rust as alternatives for creating back ends (although now with WASM it seems that Rust may be becoming more viable for front ends as well). So I did some research into the two, watched 2 minutes of Rust code being written, and decided that it would be best to try Go first.

In the last 4 days, I have been learning Go’s syntax and some basics such as setting up a web server with Gin and querying the MySql database I already have set up for Yeaow on Planetscale. It has been fun to delve into this, with the most fun coming from a constant race I have made to improve the speed of the server.

![Screen Shot 2023-01-21 at 12.50.08 PM.jpg](https://aaronanidjar.s3.amazonaws.com/goimgdiagram.jpg)

This is a model of how the Yeaow page data model is structured. There is a table for editors, a table that stores all User data, and a table that stores all of the reviews for editors. The editor table is connected to the User table through the userId field, the editor reviews table is connected to the editor table through the userId field (which is connected to the User table), and is also connected to the User table through the reviewerId field. 

The first iteration of my Go server was painfully slow since instead of using LEFT JOIN  I would query the User table each time I needed to add the User object to either a review or an editor. I was also making a new database connection each time I wanted to get reviews and users, meaning that this was slowing down my app considerably.

The first iteration of this took about 3.5s per request to get all the data needed. This was obviously way too slow, so I started to find ways to improve my performance.

The first change that I made was not making a database object every single time that I wanted to query the User table and add that to the data. Instead, I passed the db that I had opened to get the editor or to get the editor review. 

```go
func getUser(id string, db *sql.DB) User {
```

This reduced the waste of making new db connections but the change was not too substantial since I was still creating many SQL connections in different places, an issue that I will tackle later.

The real performance gains came from using LEFT JOIN. If you are unfamiliar with SQL, LEFT JOIN statements are statements that connect elements from two different tables, meaning that I could basically disregard my getUser method since I would get the User directly in the SQL query.

![Screen Shot 2023-01-21 at 1.22.53 PM.jpg](https://aaronanidjar.s3.amazonaws.com/goimg1.jpg)

![Screen Shot 2023-01-21 at 1.21.10 PM.jpg](https://aaronanidjar.s3.amazonaws.com/goimg2.jpg)

I used LEFT JOIN in this manner on the editor reviews and nearly halved the time per request since I had to make half the amount of requests. I did not need to make an additional query for User information after each editor review query. But 1.45s is still very slow. If a website takes that amount of time to get it’s data and display that to the user, it would be very noticeable, so I knew that more changes had to be made, the first of which was adding the same LEFT JOIN to the editor portion as well.

![Screen Shot 2023-01-21 at 3.01.49 PM.jpg](https://aaronanidjar.s3.amazonaws.com/goimg3.jpg)

(first and second run after starting the server)

Just adding LEFT JOIN to the editor part halved the response time. However, 800ms was still feeling too slow. I decided to try and remove excess DB connections again, this time I removed 5 excess connections since there were 5 editors and I would create a new DB connections every time I called the getReviews method. This shaved off ~350-400 ms of time, meaning that each db connection was adding around 70ms. A small amount of this improvement (around 40ms) was due to changing some unnecessary types from string to int (I messed up when first declaring the struct), but still a 350ms improvement is enormous.

![Screen Shot 2023-01-21 at 3.20.49 PM.jpg](https://aaronanidjar.s3.amazonaws.com/goimg4.jpg)

(first 3 runs after starting the server)

The final change I made was adding concurrency to the getReview method. I split the editors array in two and simultaneously attached the reviews to each editor struct in order to reduce the load times.

![Screen Shot 2023-01-21 at 3.25.37 PM.jpg](https://aaronanidjar.s3.amazonaws.com/goimg5.jpg)

(first 3 runs after starting the server)

Breaking 250ms was fun to see, but I feel that I could make this faster by using SQL more effectively. If instead of calling the getReviews method on each editor I was able to query the reviews alongside the editor and then just go through them I feel that I could reduce the time to ~150 - 200ms. I tried to make a SQL JOIN statement using UNION but was unable to make something that works just yet. Also, I could most definitely improve my skills in Go since this was the first Go program I have written after learning the language 5 days ago. 

All in all, it has been a lot of fun to explore some of what Go has to offer, even though I have not even scratched the surface yet, and be able to see the actual performance metrics improve with the code.

The fastest performance I was able to get (so far) was 200ms on one run:

![Screen Shot 2023-01-21 at 3.25.37 PM.jpg](https://aaronanidjar.s3.amazonaws.com/goimg6.jpg)

UPDATE (2/1/23): I was able to make each request faster by not closing the db connection each time it runs, but instead opening it on the main and then closing it once the server is closed. This made the fastest running time around 80ms.

![fastest image 100ms](https://aaronanidjar.s3.amazonaws.com/goimg7.jpg)

The go program is in one file, so I will leave the code here (I’m not linking to the github since I expose my planetscale credentials):

```go
package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"log"
	"fmt"
	"database/sql"
	"sync"
	//"reflect" //used for types
	//"example/gotest/backend"
	_ "github.com/go-sql-driver/mysql"

)

type User struct {
    Id   string `json:"id"`
    Name string `json:"name"`
	Email string `json:"email"`
	EmailVerified any `json:"emailVerified"`
	Image string `json:"image"`
}

type Editor struct {
	Id string `json:"id"` 
	UserId string `json:"userId"` 
	Price int `json:"price"`
	Specialties string `json:"specialties"` 
	Reel string `json:"reel"`
	Description string `json:"description"`
	User User `json:"user"`
	Stars int `json:"stars"`
	Reviews []EditorReview `json:"reviews"`
}

type EditorReview struct {
	Id string `json:"id"`
	EditorId string `json:"editorId"`
	ReviewerId string `json:"reviewerId"`
	Review string `json:"review"`
	Stars int `json:"stars"`
	User User `json:"user"`
}

func getUser(id string, db *sql.DB) User {

	queryString := "SELECT * FROM User WHERE id='" + id + "'"

	indivUser, err := db.Query(queryString)

	if (err != nil) {
		log.Fatal(err)
	}

	var user User

	for indivUser.Next() {

		err := indivUser.Scan(&user.Id, &user.Name, &user.Email, &user.EmailVerified, &user.Image)
		
		if err != nil {
			log.Fatal(err)
		}

		return user

	}

	
	return user
}

func getReviews(editorId string, db *sql.DB) []EditorReview {

	queryString := "SELECT * FROM editorsreviews LEFT JOIN User ON editorsreviews.reviewerId = User.id WHERE editorId='" + editorId + "'"

	editorReviews, err := db.Query(queryString)

	if (err != nil) {
		log.Fatal(err)
	}

	var editorReviewArr []EditorReview
	
	for editorReviews.Next() {
		
		var editorReview EditorReview
		var user User
		
		err := editorReviews.Scan(&editorReview.Id, &editorReview.EditorId, &editorReview.ReviewerId, &editorReview.Review, &editorReview.Stars, &user.Id, &user.Name, &user.Email, &user.EmailVerified, &user.Image)

		if err != nil {
			log.Fatal(err)
		}

		editorReview.User = user

		editorReviewArr = append(editorReviewArr, editorReview)
	}

	return editorReviewArr

}

func getEditors() []Editor {

	var wg sync.WaitGroup

	wg.Add(2)

	db, err := sql.Open("mysql", "**** NOT LEAKING MY PLANETSCALE CONNECTION ****")

	if err != nil {
		log.Fatal(err)
	}

	defer db.Close()

	read, err := db.Query("SELECT * FROM editors LEFT JOIN User ON editors.userId = User.id")

	if (err != nil) {
		log.Fatal(err)
	}

	var editor Editor
	var user User
	var editorsAdd []Editor

	fmt.Println()
	
	for read.Next() {
		err := read.Scan(&editor.Id, &editor.UserId, &editor.Price, &editor.Specialties, &editor.Reel, &editor.Description, &user.Id, &user.Name, &user.Email, &user.EmailVerified, &user.Image)
		if err != nil {
			log.Fatal(err)
		}

		editor.User = user

		editorsAdd = append(editorsAdd, editor)

	}

	
	
	mod:= func (i int) {
		
		half := (len(editorsAdd) / 2) - 1
		
		if (i == 0) {
			for i := 0; i < half; i++ {
				editorsAdd[i].Reviews = getReviews(editorsAdd[i].Id, db)
	
	
				starCount := 0
				starSum := 0
		
				for j := 0; j < len(editorsAdd[i].Reviews); j++ {
					starSum += editorsAdd[i].Reviews[j].Stars
					starCount++
				}
	
				editorsAdd[i].Stars = starSum / starCount
			}

		} else {
			for i := half; i < len(editorsAdd); i++ {
				editorsAdd[i].Reviews = getReviews(editorsAdd[i].Id, db)

	
				starCount := 0
				starSum := 0
		
				for j := 0; j < len(editorsAdd[i].Reviews); j++ {
					starSum += editorsAdd[i].Reviews[j].Stars
					starCount++
				}
	
				editorsAdd[i].Stars = starSum / starCount
			}
		}

		wg.Done()
	}

	

	go mod(0)
	go mod(1)

	wg.Wait()

	return editorsAdd
	
}

func main() {
	r := gin.Default()

   r.GET("/geteditors", func(c *gin.Context) {
	returnEditorsArr := getEditors()

	// THIS IS PLACEHOLDER AND A MORE SAFE CORS WOULD PROBABLY BE BETTER

	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
	c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
	c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT")

	 if returnEditorsArr == nil || len(returnEditorsArr) == 0 {

		 c.AbortWithStatus(http.StatusNotFound)

	 } else {

		 c.IndentedJSON(http.StatusOK, returnEditorsArr)

	 }
})

	
	fmt.Println()

  	r.Run()
}
```