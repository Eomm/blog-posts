--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE Developers (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL
);

CREATE TABLE Projects (
  id      INTEGER PRIMARY KEY,
  devId   INTEGER NOT NULL REFERENCES Developers(id),
  name    INTEGER NOT NULL
);

INSERT INTO Developers (id, name) VALUES (1, 'Manuel');
INSERT INTO Developers (id, name) VALUES (2, 'Vanessa');
INSERT INTO Developers (id, name) VALUES (3, 'Carlos');

INSERT INTO Projects (id, devId, name) VALUES (1, 1, 'GraphQL Loader');
INSERT INTO Projects (id, devId, name) VALUES (2, 2, 'GQL Perf');
INSERT INTO Projects (id, devId, name) VALUES (3, 2, 'GQL Awesome');
INSERT INTO Projects (id, devId, name) VALUES (4, 2, 'GQL Rocks');
INSERT INTO Projects (id, devId, name) VALUES (5, 3, 'No-code GraphQL');
INSERT INTO Projects (id, devId, name) VALUES (6, 3, 'Directives');


--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP INDEX Developers;
DROP TABLE Projects;
