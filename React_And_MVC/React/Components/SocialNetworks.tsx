import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import "./styles.scss";

export interface ISocialNetwork {
  url?: string;
  email?: string;
  type: string;
  user: string;
  value: string;
  placeholder: string;
}

interface ISocialNetworkProps {
  socialNetwork: ISocialNetwork;
}

class SocialNetworks extends React.Component<ISocialNetworkProps> {
  render() {
    const { socialNetwork } = this.props;

    const link =
      socialNetwork.type === "url"
        ? `${socialNetwork.url}${socialNetwork.user}`
        : `mailTo:${socialNetwork.email}`;

    return (
      <li className="socialNetwork">
        <div className={socialNetwork.value}></div>
        <a href={link} target="#">{link}</a>
      </li>
    );
  }
}

const mapAppStateToProps = () => {
  return {};
};

const mapDispatchToProps = (dispatch: any) => {
  return bindActionCreators({}, dispatch);
};

export default connect(mapAppStateToProps, mapDispatchToProps)(SocialNetworks);
