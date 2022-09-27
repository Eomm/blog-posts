'use strict'

module.exports = `

type Query {
  developers: [Developer]
}

type Developer {
  id: Int
  name: String 
  builtProjects: [Project]
}

type Project {
  id: Int 
  name: String
}

`
