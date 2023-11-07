import React, { useEffect, useState } from 'react'
import styles from '../styles/Programming.module.css'

export default function Programming() {

    let technologies = ["Next", "TypeScript", "TRPC"]

    const projects = [
        {
            name: "Yeaow",
            technologies: ["Next", "TypeScript", "TRPC"],
            description: "Yeaow is a full stack web platform I built using NextJS, TypeScript, TRPC, PostgreSQL, and PlanetScale. It connects content creators and video editors using a new model of listings.",
            img: "/yeaow.jpg"
        }
    ]

    let selectedTech = ["Next", "TypeScript"]

    console.log(selectedTech)

    const adjustSelectedTech = (x) => {
        console.log(x)
    }

    return (
        <div className={styles.container}>
            <div className={styles.buttons}>
                {technologies.map(x =>
                    <button style={ selectedTech.includes(x) ?  {backgroundColor: "green"} : {backgroundColor: "red"}} onClick={() => selectedTech.includes(x) ? selectedTech.splice(selectedTech.indexOf(x), 1) : selectedTech.push(x)}>{x}</button>
                )}
            </div>
            <p>{selectedTech.map(x => x)}</p>
            {projects.map(x =>
                <div className={styles.project}>
                    <div className={styles.maintext}>
                        <a className="nolink" href="https://yeaow.com">
                            <h2 className={styles.mainheader}>{x.name}</h2>
                        </a>
                        <p className={styles.maindescription}>{x.description}</p>
                    </div>
                    <img className={styles.sideimage} src={x.img}/>
                </div>
            )}
        </div>
    )
}