## mono-install

![CI Build](https://travis-ci.org/vdtn359/mono-install.svg?branch=master) [![npm version](https://badge.fury.io/js/%40vdtn359%2Fmono-install.svg)](https://badge.fury.io/js/%40vdtn359%2Fmono-install)

#### Overview
A package that will resolve local dependencies in a package.json and install them correctly without the need of publishing the local dependencies to npm. This will help reduce the complexity when dealing with monorepo application deployment.

#### Features
* Support npm local package
* Support pnpm workspace

#### Installation

```
npm i -g mono-install
```

#### Usage

```$xslt
mono-install [args] -- [install args]

Options:
  --help              Show help                                        [boolean]
  --version           Show version number                              [boolean]
  --install-dir, -i   The installation directory                       [string]
                      will create a new one if it does not exist
  --package-json, -p  package.json location                             [string]
  --package-lock, -l  Lock file (package-lock.json, pnpm-lock.yaml) location
                                                                        [string]
  --engine, -e        Engine to use
                              [string] [choices: "npm", "pnpm"] [default: "npm"]

```
Eg.

```
 mono-install --engine pnpm --install-dir build --package-json ./package.json --package-lock ../../pnpm-lock.yaml
```
