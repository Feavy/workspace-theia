# Builder stage
FROM node:18-bullseye AS build-stage

# install required tools to build the application
RUN apt-get update && apt-get install -y libxkbfile-dev libsecret-1-dev

WORKDIR /home/theia

# Copy repository files
COPY . .

# Remove unnecesarry files for the browser application
# Download plugins and build application production mode
# Use yarn autoclean to remove unnecessary files from package dependencies
RUN yarn config set network-timeout 600000 -g && \
    yarn --pure-lockfile && \
    yarn build:extensions && \
    yarn download:plugins && \
    yarn browser build && \
    yarn && \
    yarn autoclean --init && \
    echo *.ts >> .yarnclean && \
    echo *.ts.map >> .yarnclean && \
    echo *.spec.* >> .yarnclean && \
    yarn autoclean --force && \
    yarn cache clean && \
    rm -rf .git applications/electron theia-extensions/launcher theia-extensions/updater node_modules

# Production stage uses a small base image
FROM node:18-bullseye-slim AS production-stage

# Install required tools for application: Temurin JDK, JDK, SSH, Bash, Maven
# Node is already available in base image
RUN apt-get update && \
    apt-get install -y wget curl software-properties-common apt-transport-https && \
    apt-get update && apt-get install -y git openssh-client openssh-server bash libsecret-1-0 openjdk-17-jdk maven && \
    apt-get install -y \
    zip \
    unzip \
    bash-completion \
    build-essential \
    ninja-build \
    clang \
    htop \
    iputils-ping \
    jq \
    less \
    locales \
    man-db \
    nano \
    ripgrep \
    sudo \
    stow \
    time \
    emacs-nox \
    vim \
    multitail \
    lsof \
    ssl-cert \
    fish \
    zsh \
    rlwrap && \
    add-apt-repository -y ppa:git-core/ppa && \
    curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | bash && \
    apt-get install -y git git-lfs && \
    add-apt-repository -r -y ppa:git-core/ppa && \
    npm install -g zx && \
    locale-gen en_US.UTF-8 && \
    apt-get clean

# Create theia user and directories
# Application will be copied to /home/theia
# Default workspace is located at /home/project
RUN adduser --system --group theia && \
    usermod -aG sudo theia && \
    sed -i.bkp -e "/Defaults\tuse_pty/d" -e "s/%sudo\s\+ALL=(ALL\(:ALL\)\?)\s\+ALL/%sudo ALL=NOPASSWD:ALL/g" /etc/sudoers

RUN chmod g+rw /home && \
    mkdir -p /home/project && \
    chown -R theia:theia /home/theia && \
    chown -R theia:theia /home/project;

ENV LANG=en_US.UTF-8

ENV HOME /home/theia
WORKDIR /home/theia

# Copy application from builder-stage
COPY --from=build-stage --chown=theia:theia /home/theia /home/theia

EXPOSE 28544

# Specify default shell for Theia and the Built-In plugins directory
ENV SHELL=/bin/bash \
    THEIA_DEFAULT_PLUGINS=local-dir:/home/theia/plugins

# Use installed git instead of dugite
ENV USE_LOCAL_GIT true

# Create workspace directory
RUN mkdir -p /workspace && \
    chown theia:theia /workspace

# Swtich to Theia user
USER theia
ENV HOME=/home/theia
WORKDIR $HOME

# custom Bash prompt with git branch
RUN curl -L https://raw.github.com/git/git/master/contrib/completion/git-prompt.sh > /home/theia/.bash_git && \
    echo "source ~/.bash_git;PS1='\[\033[01;32m\]\u\[\033[00m\] \[\033[01;34m\]\w\[\033[00m\]\$(__git_ps1 \" (%s)\") $ '" >> /home/theia/.bashrc && \
    echo "source ~/.bashrc" >> /home/theia/.bash_profile

COPY --chown=theia:theia default.gitconfig /home/theia/.gitconfig

# Launch the backend application via node
ENTRYPOINT [ "node", "/home/theia/applications/browser/lib/backend/main.js" ]

# Arguments passed to the application
CMD [ "/home/project", "--hostname=0.0.0.0" ]
