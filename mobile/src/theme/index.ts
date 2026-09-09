import { StyleSheet } from 'react-native';
export const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#F3F6F3'},container:{padding:24,gap:20,width:'100%',maxWidth:760,alignSelf:'center'},
  title:{fontSize:32,fontWeight:'700',color:'#153F32'},text:{fontSize:20,lineHeight:30,color:'#193D32'},
  label:{fontSize:20,fontWeight:'600',color:'#193D32'},input:{fontSize:22,minHeight:60,borderWidth:2,borderColor:'#527266',borderRadius:12,padding:14,backgroundColor:'#FFFFFF',color:'#182E26'},
  button:{minHeight:60,borderRadius:12,padding:16,backgroundColor:'#155E46',alignItems:'center',justifyContent:'center'},buttonText:{fontSize:22,fontWeight:'700',color:'#FFFFFF',textAlign:'center'},
  secondary:{backgroundColor:'#304F66'},card:{padding:24,borderRadius:20,gap:16,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#708A7E'},
  error:{fontSize:20,color:'#8C2020',lineHeight:30},row:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:12}
});
